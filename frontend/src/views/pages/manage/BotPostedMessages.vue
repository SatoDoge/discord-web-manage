<script setup>
import DiscordEmbedPreview from '@/components/manage/DiscordEmbedPreview.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { useMessageAttachments } from '@/composables/useMessageAttachments';
import { apiFetch } from '@/utils/api';
import { parseEmbedJsonInput } from '@/utils/discordEmbed';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const {
    channelNameById,
    memberNameById,
    loading: loadingOptions,
    loadDiscordOptions
} = useDiscordOptions();

const postedMessages = ref([]);
const scheduledMessages = ref([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const sendingNow = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    originType: { value: null, matchMode: FilterMatchMode.EQUALS },
    deliveryStatus: { value: null, matchMode: FilterMatchMode.EQUALS }
});

const {
    attachments: newAttachments,
    attachmentCount,
    hasAttachments,
    maxAttachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    handlePaste,
    formatFileSize
} = useMessageAttachments();

const fileInputRef = ref(null);
const initialExistingAttachmentKeys = ref(new Set());

const detailDialog = reactive({
    visible: false,
    row: null,
    content: '',
    embedJson: '[]',
    reason: '',
    scheduledAt: null,
    existingAttachments: []
});

const deleteDialog = reactive({
    visible: false,
    row: null,
    reason: ''
});

const originOptions = computed(() => [
    { label: t('manage.botPosted.originManual'), value: 'manual' },
    { label: t('manage.botPosted.originScheduled'), value: 'scheduled' }
]);

const deliveryStatusOptions = computed(() => [
    { label: t('manage.botPosted.deliveryPending'), value: 'pending' },
    { label: t('manage.botPosted.deliverySent'), value: 'sent' },
    { label: t('manage.botPosted.deliveryFailed'), value: 'failed' },
    { label: t('manage.botPosted.statusActive'), value: 'active' },
    { label: t('manage.botPosted.statusDeleted'), value: 'deleted' }
]);

const loadingAll = computed(() => loading.value || loadingOptions.value);

const tableRows = computed(() => {
    const postedByMessageId = new Map(
        postedMessages.value.map((message) => [message.messageId, message])
    );
    const scheduledById = new Map(scheduledMessages.value.map((message) => [message.id, message]));
    const linkedPostedIds = new Set();
    const rows = [];

    for (const scheduled of scheduledMessages.value) {
        const posted =
            (scheduled.resultingMessageId
                ? postedByMessageId.get(scheduled.resultingMessageId)
                : null) ??
            postedMessages.value.find((message) => message.scheduledMessageId === scheduled.id) ??
            null;

        if (posted) {
            linkedPostedIds.add(posted.messageId);
        }

        rows.push(buildScheduledRow(scheduled, posted));
    }

    for (const posted of postedMessages.value) {
        if (linkedPostedIds.has(posted.messageId)) {
            continue;
        }
        if (posted.scheduledMessageId && scheduledById.has(posted.scheduledMessageId)) {
            continue;
        }
        rows.push(buildPostedRow(posted));
    }

    return rows.sort((a, b) => {
        const aTime = new Date(a.sortAt).getTime();
        const bTime = new Date(b.sortAt).getTime();
        return bTime - aTime;
    });
});

const parsedEditEmbeds = computed(() => parseEmbedJsonInput(detailDialog.embedJson));

const editPreviewEmbeds = computed(() =>
    parsedEditEmbeds.value.ok ? parsedEditEmbeds.value.embeds : []
);

const editPreviewError = computed(() => {
    if (!detailDialog.embedJson.trim() || detailDialog.embedJson.trim() === '[]') {
        return null;
    }
    if (!parsedEditEmbeds.value.ok) {
        return t(`manage.send.embedErrors.${parsedEditEmbeds.value.error}`);
    }
    return null;
});

const isPendingSchedule = computed(
    () => detailDialog.row?.kind === 'scheduled' && detailDialog.row.deliveryStatus === 'pending'
);

const isEditablePosted = computed(() => {
    const row = detailDialog.row;
    if (!row) {
        return false;
    }
    if (row.posted && !row.posted.isDeleted) {
        return true;
    }
    return false;
});

const canEditContent = computed(() => isPendingSchedule.value || isEditablePosted.value);

const canSaveDetail = computed(() => {
    if (!detailDialog.row || saving.value || !canEditContent.value) {
        return false;
    }

    if (isPendingSchedule.value) {
        if (!detailDialog.scheduledAt || new Date(detailDialog.scheduledAt).getTime() <= Date.now()) {
            return false;
        }
    }

    const hasContent = Boolean(detailDialog.content.trim());
    const hasEmbeds = parsedEditEmbeds.value.ok && parsedEditEmbeds.value.embeds.length > 0;
    const hasNewAttachments = hasAttachments.value;
    const hasExistingAttachments = detailDialog.existingAttachments.length > 0;
    if (isPendingSchedule.value) {
        if (!hasContent && !hasEmbeds && !hasNewAttachments && !hasExistingAttachments) {
            return false;
        }
    } else if (!hasContent && !hasEmbeds && !hasNewAttachments) {
        return false;
    }
    if (detailDialog.embedJson.trim() && detailDialog.embedJson.trim() !== '[]' && !parsedEditEmbeds.value.ok) {
        return false;
    }
    return true;
});

const attachmentsChanged = computed(() => {
    if (hasAttachments.value) {
        return true;
    }
    const currentKeys = new Set(detailDialog.existingAttachments.map(attachmentKey));
    if (currentKeys.size !== initialExistingAttachmentKeys.value.size) {
        return true;
    }
    for (const key of currentKeys) {
        if (!initialExistingAttachmentKeys.value.has(key)) {
            return true;
        }
    }
    return false;
});

const scheduleMinDate = computed(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 1, 0, 0);
    return date;
});

const busy = computed(() => saving.value || deleting.value || sendingNow.value);

function buildScheduledRow(scheduled, posted) {
    let deliveryStatus = 'pending';
    if (scheduled.success === true) {
        deliveryStatus = 'sent';
    } else if (scheduled.success === false) {
        deliveryStatus = 'failed';
    }

    return {
        rowKey: `scheduled:${scheduled.id}`,
        kind: 'scheduled',
        originType: 'scheduled',
        deliveryStatus,
        channelId: scheduled.destination.channelId,
        content: scheduled.payload.content,
        embeds: scheduled.payload.embeds ?? [],
        attachments: scheduled.payload.attachments ?? [],
        postedByUserId: scheduled.createdByUserId,
        scheduledAt: scheduled.scheduledAt,
        sentAt: scheduled.sentAt,
        createdAt: scheduled.createdAt,
        updatedAt: scheduled.updatedAt,
        sortAt: scheduled.scheduledAt || scheduled.createdAt,
        messageId: posted?.messageId ?? scheduled.resultingMessageId ?? null,
        guildId: posted?.guildId ?? null,
        error: scheduled.error,
        scheduled,
        posted
    };
}

function buildPostedRow(posted) {
    const originType = posted.origin === 'scheduled' ? 'scheduled' : 'manual';
    return {
        rowKey: `posted:${posted.messageId}`,
        kind: 'posted',
        originType,
        deliveryStatus: posted.isDeleted ? 'deleted' : 'active',
        channelId: posted.channelId,
        content: posted.content,
        embeds: posted.embeds ?? [],
        attachments: posted.attachments ?? [],
        postedByUserId: posted.postedByUserId,
        scheduledAt: null,
        sentAt: posted.createdAt,
        createdAt: posted.createdAt,
        updatedAt: posted.updatedAt,
        sortAt: posted.createdAt,
        messageId: posted.messageId,
        guildId: posted.guildId,
        error: null,
        scheduled: null,
        posted
    };
}

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function formatChannelName(channelId) {
    const name = channelNameById.value.get(channelId);
    return name ? `#${name}` : channelId;
}

function posterLabel(userId) {
    return memberNameById.value.get(userId) ?? userId;
}

function originLabel(originType) {
    return originType === 'scheduled'
        ? t('manage.botPosted.originScheduled')
        : t('manage.botPosted.originManual');
}

function deliveryLabel(status) {
    switch (status) {
        case 'pending':
            return t('manage.botPosted.deliveryPending');
        case 'sent':
            return t('manage.botPosted.deliverySent');
        case 'failed':
            return t('manage.botPosted.deliveryFailed');
        case 'deleted':
            return t('manage.botPosted.statusDeleted');
        default:
            return t('manage.botPosted.statusActive');
    }
}

function deliverySeverity(status) {
    switch (status) {
        case 'pending':
            return 'warn';
        case 'sent':
        case 'active':
            return 'success';
        case 'failed':
        case 'deleted':
            return 'danger';
        default:
            return 'secondary';
    }
}

function messagePreview(row) {
    const text = row.content?.trim();
    if (text) {
        return text.length > 80 ? `${text.slice(0, 77)}...` : text;
    }
    if (row.attachments?.length) {
        return t('manage.botPosted.attachmentCount', { count: row.attachments.length });
    }
    if (row.embeds?.length) {
        const title = row.embeds[0]?.title?.trim();
        if (title) {
            return `[Embed] ${title}`;
        }
        return t('manage.botPosted.embedOnly');
    }
    return '—';
}

function messageDiscordUrl(row) {
    if (!row.guildId || !row.messageId) {
        return null;
    }
    return `https://discord.com/channels/${row.guildId}/${row.channelId}/${row.messageId}`;
}

function embedsToJson(embeds) {
    if (!embeds?.length) {
        return '[]';
    }
    return JSON.stringify(embeds.length === 1 ? embeds[0] : embeds, null, 2);
}

function attachmentKey(attachment) {
    return `${attachment.filename}:${attachment.size}`;
}

function showAttachmentError(result) {
    if (!result || result.ok) {
        return;
    }
    const key = `manage.botPosted.errors.${result.error}`;
    const translated = t(key);
    toast.add({
        severity: 'error',
        summary: t('toast.actionFailed'),
        detail: translated === key ? t('manage.botPosted.actionFailed') : translated,
        life: 5000
    });
}

function openFilePicker() {
    fileInputRef.value?.click();
}

function onFileInputChange(event) {
    const result = addFiles(event.target.files);
    event.target.value = '';
    if (!result.ok) {
        showAttachmentError(result);
        return;
    }
    if (isPendingSchedule.value) {
        detailDialog.existingAttachments = [];
    }
    if (result.truncated) {
        toast.add({
            severity: 'warn',
            summary: t('manage.send.attachmentsTruncated'),
            detail: t('manage.send.attachmentsTruncatedDetail', { max: maxAttachments }),
            life: 4000
        });
    }
}

function onEditPaste(event) {
    const result = handlePaste(event);
    if (!result) {
        return;
    }
    if (!result.ok) {
        showAttachmentError(result);
        return;
    }
    if (result.truncated) {
        toast.add({
            severity: 'warn',
            summary: t('manage.send.attachmentsTruncated'),
            detail: t('manage.send.attachmentsTruncatedDetail', { max: maxAttachments }),
            life: 4000
        });
    }
}

function removeExistingAttachment(attachment) {
    const key = attachmentKey(attachment);
    detailDialog.existingAttachments = detailDialog.existingAttachments.filter(
        (entry) => attachmentKey(entry) !== key
    );
}

function resetEditAttachments() {
    clearAttachments();
    initialExistingAttachmentKeys.value = new Set();
    detailDialog.existingAttachments = [];
}

function buildEditEmbedsPayload() {
    if (detailDialog.embedJson.trim() && detailDialog.embedJson.trim() !== '[]') {
        return parsedEditEmbeds.value.ok ? parsedEditEmbeds.value.payload : [];
    }
    return [];
}

function actionErrorMessage(error) {
    const scheduledKey = `manage.botPosted.scheduleErrors.${error}`;
    const scheduledTranslated = t(scheduledKey);
    if (scheduledTranslated !== scheduledKey) {
        return scheduledTranslated;
    }
    const key = `manage.botPosted.errors.${error}`;
    const translated = t(key);
    return translated === key ? t('manage.botPosted.actionFailed') : translated;
}

async function loadMessages() {
    loading.value = true;
    try {
        const [postedData, scheduledData] = await Promise.all([
            apiFetch('/api/bot-messages'),
            apiFetch('/api/scheduled-messages')
        ]);
        postedMessages.value = postedData.messages ?? [];
        scheduledMessages.value = scheduledData.messages ?? [];
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.botPosted.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function openDetail(row) {
    resetEditAttachments();
    detailDialog.row = row;
    detailDialog.content = row.content ?? '';
    detailDialog.embedJson = embedsToJson(row.embeds);
    detailDialog.reason = '';
    detailDialog.scheduledAt = row.scheduledAt ? new Date(row.scheduledAt) : null;
    detailDialog.existingAttachments = [...(row.attachments ?? [])];
    initialExistingAttachmentKeys.value = new Set(
        detailDialog.existingAttachments.map(attachmentKey)
    );
    detailDialog.visible = true;
}

function openDelete(row) {
    if (row.kind === 'posted' && row.posted?.isDeleted) {
        return;
    }
    if (row.kind === 'scheduled' && row.deliveryStatus === 'sent' && row.posted?.isDeleted) {
        return;
    }
    deleteDialog.row = row;
    deleteDialog.reason = '';
    deleteDialog.visible = true;
}

async function saveDetail() {
    if (!canSaveDetail.value || !detailDialog.row) {
        return;
    }

    saving.value = true;
    try {
        if (isPendingSchedule.value) {
            await savePendingSchedule();
        } else if (isEditablePosted.value) {
            await savePostedMessage();
        }

        toast.add({
            severity: 'success',
            summary: t('manage.botPosted.updateSuccess'),
            life: 4000
        });
        detailDialog.visible = false;
        resetEditAttachments();
        await loadMessages();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail: actionErrorMessage(error.message),
            life: 6000
        });
    } finally {
        saving.value = false;
    }
}

async function savePendingSchedule() {
    const id = detailDialog.row.scheduled.id;
    const embedsPayload = buildEditEmbedsPayload();
    const clearAttachmentsOnly =
        attachmentsChanged.value && !hasAttachments.value && detailDialog.existingAttachments.length === 0;
    const replaceAttachments = hasAttachments.value || clearAttachmentsOnly;

    if (attachmentsChanged.value && !replaceAttachments) {
        throw new Error('schedule_attachment_reupload_required');
    }

    if (replaceAttachments) {
        const formData = new FormData();
        formData.append('content', detailDialog.content);
        formData.append('embeds', JSON.stringify(embedsPayload));
        formData.append('scheduledAt', new Date(detailDialog.scheduledAt).toISOString());
        formData.append('replaceAttachments', 'true');
        for (const entry of newAttachments.value) {
            formData.append('attachments', entry.file);
        }
        await apiFetch(`/api/scheduled-messages/${id}`, {
            method: 'PATCH',
            body: formData
        });
        return;
    }

    await apiFetch(`/api/scheduled-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: detailDialog.content,
            embeds: embedsPayload,
            scheduledAt: new Date(detailDialog.scheduledAt).toISOString()
        })
    });
}

async function savePostedMessage() {
    const messageId = detailDialog.row.posted.messageId;
    const embedsPayload = buildEditEmbedsPayload();

    if (attachmentsChanged.value) {
        const formData = new FormData();
        formData.append('content', detailDialog.content);
        formData.append('embeds', JSON.stringify(embedsPayload));
        formData.append('replaceAttachments', 'true');
        if (detailDialog.reason.trim()) {
            formData.append('reason', detailDialog.reason.trim());
        }
        for (const entry of newAttachments.value) {
            formData.append('attachments', entry.file);
        }

        await apiFetch(`/api/bot-messages/${messageId}`, {
            method: 'PATCH',
            body: formData
        });
        return;
    }

    await apiFetch(`/api/bot-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: detailDialog.content,
            embeds: embedsPayload,
            reason: detailDialog.reason.trim() || undefined
        })
    });
}

async function sendNow() {
    if (!isPendingSchedule.value || !detailDialog.row?.scheduled) {
        return;
    }

    sendingNow.value = true;
    try {
        await apiFetch(`/api/scheduled-messages/${detailDialog.row.scheduled.id}/send-now`, {
            method: 'POST'
        });
        toast.add({
            severity: 'success',
            summary: t('manage.botPosted.sendNowSuccess'),
            life: 4000
        });
        detailDialog.visible = false;
        resetEditAttachments();
        await loadMessages();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail: actionErrorMessage(error.message),
            life: 6000
        });
        await loadMessages();
    } finally {
        sendingNow.value = false;
    }
}

async function confirmDelete() {
    if (!deleteDialog.row) {
        return;
    }

    deleting.value = true;
    try {
        const row = deleteDialog.row;

        if (row.kind === 'scheduled' && row.deliveryStatus === 'pending') {
            await apiFetch(`/api/scheduled-messages/${row.scheduled.id}`, {
                method: 'DELETE'
            });
        } else if (row.kind === 'scheduled' && row.deliveryStatus === 'failed') {
            await apiFetch(`/api/scheduled-messages/${row.scheduled.id}`, {
                method: 'DELETE'
            });
        } else if (row.posted && !row.posted.isDeleted) {
            await apiFetch(`/api/bot-messages/${row.posted.messageId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: deleteDialog.reason.trim() || undefined
                })
            });
            if (row.kind === 'scheduled' && row.scheduled) {
                await apiFetch(`/api/scheduled-messages/${row.scheduled.id}`, {
                    method: 'DELETE'
                }).catch(() => undefined);
            }
        } else if (row.kind === 'scheduled' && row.scheduled) {
            await apiFetch(`/api/scheduled-messages/${row.scheduled.id}`, {
                method: 'DELETE'
            });
        }

        toast.add({
            severity: 'success',
            summary: t('manage.botPosted.deleteSuccess'),
            life: 4000
        });
        deleteDialog.visible = false;
        if (detailDialog.visible) {
            detailDialog.visible = false;
            resetEditAttachments();
        }
        await loadMessages();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail: actionErrorMessage(error.message),
            life: 6000
        });
    } finally {
        deleting.value = false;
    }
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        originType: { value: null, matchMode: FilterMatchMode.EQUALS },
        deliveryStatus: { value: null, matchMode: FilterMatchMode.EQUALS }
    };
}

function canOpenDelete(row) {
    if (row.kind === 'scheduled') {
        return true;
    }
    return Boolean(row.posted && !row.posted.isDeleted);
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadMessages()]);
});
</script>

<template>
    <Fluid>
        <div class="card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <div class="font-semibold text-xl">{{ t('manage.botPosted.title') }}</div>
                    <p class="text-muted-color m-0 mt-1">{{ t('manage.botPosted.description') }}</p>
                </div>
                <Button
                    :label="t('manage.botPosted.refresh')"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    :disabled="loadingAll"
                    @click="loadMessages"
                />
            </div>

            <DataTable
                v-model:filters="filters"
                :value="tableRows"
                dataKey="rowKey"
                paginator
                :rows="15"
                :rowsPerPageOptions="[10, 15, 25, 50]"
                :loading="loadingAll"
                :globalFilterFields="['messageId', 'channelId', 'content', 'postedByUserId', 'rowKey']"
                :rowHover="true"
                showGridlines
                responsiveLayout="scroll"
                @row-click="(event) => openDetail(event.data)"
            >
                <template #header>
                    <div class="flex flex-wrap justify-between gap-3">
                        <Button
                            type="button"
                            icon="pi pi-filter-slash"
                            :label="t('manage.botPosted.clearFilters')"
                            outlined
                            :disabled="loadingAll"
                            @click="clearFilter"
                        />
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText
                                v-model="filters['global'].value"
                                :placeholder="t('manage.botPosted.searchPlaceholder')"
                            />
                        </IconField>
                    </div>
                </template>

                <template #empty>{{ t('manage.botPosted.empty') }}</template>
                <template #loading>{{ t('manage.botPosted.loading') }}</template>

                <Column field="originType" filter :header="t('manage.botPosted.origin')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag
                            :value="originLabel(data.originType)"
                            :severity="data.originType === 'scheduled' ? 'info' : 'secondary'"
                        />
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <Select
                            v-model="filterModel.value"
                            :options="originOptions"
                            optionLabel="label"
                            optionValue="value"
                            :placeholder="t('common.any')"
                            showClear
                            class="w-full"
                            @change="filterCallback()"
                        />
                    </template>
                </Column>

                <Column field="deliveryStatus" filter :header="t('manage.botPosted.status')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag
                            :value="deliveryLabel(data.deliveryStatus)"
                            :severity="deliverySeverity(data.deliveryStatus)"
                        />
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <Select
                            v-model="filterModel.value"
                            :options="deliveryStatusOptions"
                            optionLabel="label"
                            optionValue="value"
                            :placeholder="t('common.any')"
                            showClear
                            class="w-full"
                            @change="filterCallback()"
                        />
                    </template>
                </Column>

                <Column field="scheduledAt" :header="t('manage.botPosted.scheduledAt')" style="min-width: 11rem">
                    <template #body="{ data }">
                        {{ formatDate(data.scheduledAt) }}
                    </template>
                </Column>

                <Column field="messageId" :header="t('manage.messages.messageId')" style="min-width: 12rem">
                    <template #body="{ data }">
                        <a
                            v-if="messageDiscordUrl(data)"
                            :href="messageDiscordUrl(data)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="font-mono text-sm message-link"
                            @click.stop
                        >
                            {{ data.messageId }}
                        </a>
                        <span v-else class="text-muted-color">—</span>
                    </template>
                </Column>

                <Column :header="t('manage.messages.channel')" style="min-width: 10rem">
                    <template #body="{ data }">
                        {{ formatChannelName(data.channelId) }}
                    </template>
                </Column>

                <Column :header="t('manage.messages.content')" style="min-width: 16rem">
                    <template #body="{ data }">
                        <div class="message-preview">{{ messagePreview(data) }}</div>
                    </template>
                </Column>

                <Column :header="t('manage.botPosted.postedBy')" style="min-width: 10rem">
                    <template #body="{ data }">
                        {{ posterLabel(data.postedByUserId) }}
                    </template>
                </Column>

                <Column field="createdAt" :header="t('manage.botPosted.postedAt')" style="min-width: 11rem">
                    <template #body="{ data }">
                        {{ formatDate(data.sentAt || data.createdAt) }}
                    </template>
                </Column>

                <Column :header="t('manage.botPosted.actions')" style="min-width: 9rem">
                    <template #body="{ data }">
                        <div class="flex flex-wrap gap-2" @click.stop>
                            <Button
                                icon="pi pi-pencil"
                                severity="secondary"
                                text
                                rounded
                                :disabled="busy"
                                @click="openDetail(data)"
                            />
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                text
                                rounded
                                :disabled="busy || !canOpenDelete(data)"
                                @click="openDelete(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </Fluid>

    <Dialog
        v-model:visible="detailDialog.visible"
        modal
        :header="
            isPendingSchedule
                ? t('manage.botPosted.scheduleDialogTitle')
                : t('manage.botPosted.editDialogTitle')
        "
        :style="{ width: 'min(72rem, 96vw)' }"
        :closable="!busy"
    >
        <div class="grid grid-cols-12 gap-6" @paste="onEditPaste">
            <div class="col-span-12 xl:col-span-6 flex flex-col gap-4">
                <div v-if="detailDialog.row" class="flex flex-wrap gap-2">
                    <Tag
                        :value="originLabel(detailDialog.row.originType)"
                        :severity="detailDialog.row.originType === 'scheduled' ? 'info' : 'secondary'"
                    />
                    <Tag
                        :value="deliveryLabel(detailDialog.row.deliveryStatus)"
                        :severity="deliverySeverity(detailDialog.row.deliveryStatus)"
                    />
                    <span v-if="detailDialog.row.error" class="text-red-400 text-sm">
                        {{ actionErrorMessage(detailDialog.row.error) }}
                    </span>
                </div>

                <div v-if="detailDialog.row?.kind === 'scheduled'" class="flex flex-col gap-2">
                    <label for="detail-scheduled-at">{{ t('manage.botPosted.scheduledAt') }}</label>
                    <DatePicker
                        id="detail-scheduled-at"
                        v-model="detailDialog.scheduledAt"
                        showTime
                        hourFormat="24"
                        showIcon
                        iconDisplay="input"
                        :minDate="scheduleMinDate"
                        class="w-full"
                        :disabled="busy || !isPendingSchedule"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <label>{{ t('manage.send.attachments') }}</label>
                        <span class="text-muted-color text-sm">
                            {{ t('manage.send.attachmentCount', { count: attachmentCount, max: maxAttachments }) }}
                        </span>
                    </div>
                    <input
                        ref="fileInputRef"
                        type="file"
                        class="hidden"
                        multiple
                        :disabled="busy || !canEditContent || attachmentCount >= maxAttachments"
                        @change="onFileInputChange"
                    />
                    <div class="flex flex-wrap gap-2">
                        <Button
                            :label="t('manage.send.addAttachment')"
                            icon="pi pi-paperclip"
                            severity="secondary"
                            outlined
                            :disabled="busy || !canEditContent || attachmentCount >= maxAttachments"
                            @click="openFilePicker"
                        />
                    </div>
                    <small class="text-muted-color">
                        {{
                            isPendingSchedule
                                ? t('manage.botPosted.scheduleAttachmentHint')
                                : t('manage.botPosted.editAttachmentHint')
                        }}
                    </small>
                    <div v-if="detailDialog.existingAttachments.length" class="attachment-list">
                        <div
                            v-for="attachment in detailDialog.existingAttachments"
                            :key="attachmentKey(attachment)"
                            class="attachment-item"
                        >
                            <div class="attachment-file-icon">
                                <i class="pi pi-file" />
                            </div>
                            <div class="attachment-meta min-w-0">
                                <div class="attachment-name">{{ attachment.filename }}</div>
                                <div class="text-muted-color text-sm">{{ formatFileSize(attachment.size) }}</div>
                            </div>
                            <Button
                                icon="pi pi-times"
                                severity="danger"
                                text
                                rounded
                                :disabled="busy || !canEditContent"
                                @click="removeExistingAttachment(attachment)"
                            />
                        </div>
                    </div>
                    <div v-if="newAttachments.length" class="attachment-list">
                        <div v-for="entry in newAttachments" :key="entry.id" class="attachment-item">
                            <img
                                v-if="entry.previewUrl"
                                :src="entry.previewUrl"
                                :alt="entry.file.name"
                                class="attachment-thumb"
                            />
                            <div v-else class="attachment-file-icon">
                                <i class="pi pi-file" />
                            </div>
                            <div class="attachment-meta min-w-0">
                                <div class="attachment-name">{{ entry.file.name }}</div>
                                <div class="text-muted-color text-sm">{{ formatFileSize(entry.file.size) }}</div>
                            </div>
                            <Button
                                icon="pi pi-times"
                                severity="danger"
                                text
                                rounded
                                :disabled="busy"
                                @click="removeAttachment(entry.id)"
                            />
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit-content">{{ t('manage.send.textContent') }}</label>
                    <Textarea
                        id="edit-content"
                        v-model="detailDialog.content"
                        rows="10"
                        class="w-full font-mono"
                        :disabled="busy || !canEditContent"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit-embed-json">{{ t('manage.send.embedJson') }}</label>
                    <Textarea
                        id="edit-embed-json"
                        v-model="detailDialog.embedJson"
                        rows="12"
                        class="w-full font-mono text-sm"
                        :disabled="busy || !canEditContent"
                    />
                    <small class="text-muted-color">{{ t('manage.send.embedJsonHint') }}</small>
                </div>

                <div v-if="isEditablePosted && !isPendingSchedule" class="flex flex-col gap-2">
                    <label for="edit-reason">{{ t('manage.send.reasonOptional') }}</label>
                    <InputText
                        id="edit-reason"
                        v-model="detailDialog.reason"
                        :placeholder="t('manage.messages.reasonAuditPlaceholder')"
                        class="w-full"
                        :disabled="busy"
                    />
                </div>
            </div>

            <div class="col-span-12 xl:col-span-6 flex flex-col gap-3">
                <div class="font-medium">{{ t('manage.send.preview') }}</div>
                <div class="preview-shell">
                    <Message v-if="editPreviewError" severity="warn" :closable="false">
                        {{ editPreviewError }}
                    </Message>
                    <div
                        v-else-if="!detailDialog.content.trim() && (!detailDialog.embedJson.trim() || detailDialog.embedJson.trim() === '[]') && !newAttachments.length && !detailDialog.existingAttachments.length"
                        class="preview-empty"
                    >
                        {{ t('manage.botPosted.previewEmpty') }}
                    </div>
                    <template v-else>
                        <DiscordEmbedPreview :content="detailDialog.content" :embeds="editPreviewEmbeds" />
                        <div v-if="newAttachments.length || detailDialog.existingAttachments.length" class="preview-attachments">
                            <div class="font-medium text-sm mb-2">{{ t('manage.send.attachments') }}</div>
                            <div class="attachment-preview-grid">
                                <div
                                    v-for="attachment in detailDialog.existingAttachments"
                                    :key="`existing-${attachmentKey(attachment)}`"
                                    class="attachment-preview-item"
                                >
                                    <div class="attachment-preview-file">
                                        <i class="pi pi-file" />
                                        <span>{{ attachment.filename }}</span>
                                    </div>
                                </div>
                                <div v-for="entry in newAttachments" :key="entry.id" class="attachment-preview-item">
                                    <img
                                        v-if="entry.previewUrl"
                                        :src="entry.previewUrl"
                                        :alt="entry.file.name"
                                        class="attachment-preview-image"
                                    />
                                    <div v-else class="attachment-preview-file">
                                        <i class="pi pi-file" />
                                        <span>{{ entry.file.name }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex flex-wrap justify-between gap-3 w-full">
                <div class="flex flex-wrap gap-2">
                    <Button
                        v-if="isPendingSchedule"
                        :label="t('manage.botPosted.sendNow')"
                        icon="pi pi-send"
                        severity="help"
                        outlined
                        :loading="sendingNow"
                        :disabled="busy"
                        @click="sendNow"
                    />
                    <Button
                        v-if="detailDialog.row && canOpenDelete(detailDialog.row)"
                        :label="t('manage.botPosted.delete')"
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        :disabled="busy"
                        @click="openDelete(detailDialog.row)"
                    />
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        :label="t('manage.botPosted.cancel')"
                        severity="secondary"
                        outlined
                        :disabled="busy"
                        @click="detailDialog.visible = false"
                    />
                    <Button
                        v-if="canEditContent"
                        :label="t('manage.botPosted.save')"
                        icon="pi pi-check"
                        :loading="saving"
                        :disabled="!canSaveDetail"
                        @click="saveDetail"
                    />
                </div>
            </div>
        </template>
    </Dialog>

    <Dialog
        v-model:visible="deleteDialog.visible"
        modal
        :header="t('manage.botPosted.deleteDialogTitle')"
        :style="{ width: '32rem' }"
        :closable="!deleting"
    >
        <div class="flex flex-col gap-4">
            <Message severity="warn" :closable="false">
                {{
                    deleteDialog.row?.kind === 'scheduled' && deleteDialog.row.deliveryStatus !== 'sent'
                        ? t('manage.botPosted.deleteScheduleWarning')
                        : t('manage.botPosted.deleteDialogWarning')
                }}
            </Message>

            <div
                v-if="deleteDialog.row?.posted && !deleteDialog.row.posted.isDeleted"
                class="flex flex-col gap-2"
            >
                <label for="delete-reason">{{ t('manage.send.reasonOptional') }}</label>
                <Textarea
                    id="delete-reason"
                    v-model="deleteDialog.reason"
                    rows="3"
                    class="w-full"
                    :disabled="deleting"
                    :placeholder="t('manage.messages.reasonAuditPlaceholder')"
                />
            </div>
        </div>

        <template #footer>
            <Button
                :label="t('manage.botPosted.cancel')"
                severity="secondary"
                outlined
                :disabled="deleting"
                @click="deleteDialog.visible = false"
            />
            <Button
                :label="t('manage.botPosted.delete')"
                icon="pi pi-trash"
                severity="danger"
                :loading="deleting"
                @click="confirmDelete"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.message-preview {
    white-space: pre-wrap;
    word-break: break-word;
}

.message-link {
    color: var(--primary-color);
    text-decoration: none;
}

.message-link:hover {
    text-decoration: underline;
}

.preview-shell {
    min-height: 16rem;
    padding: 1rem;
    border-radius: 8px;
    background: #313338;
    border: 1px solid var(--surface-border);
}

.preview-empty {
    color: #b5bac1;
    font-style: italic;
}

.attachment-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.attachment-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
}

.attachment-thumb {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
}

.attachment-file-icon {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-100);
    border-radius: 4px;
    flex-shrink: 0;
}

.attachment-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.preview-attachments {
    margin-top: 0.75rem;
}

.attachment-preview-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.attachment-preview-item {
    max-width: 12rem;
}

.attachment-preview-image {
    max-width: 100%;
    max-height: 8rem;
    border-radius: 4px;
}

.attachment-preview-file {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #2b2d31;
    border-radius: 4px;
    font-size: 0.875rem;
    word-break: break-word;
}
</style>
