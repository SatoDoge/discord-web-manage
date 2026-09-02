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

const messages = ref([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    sendMode: { value: null, matchMode: FilterMatchMode.EQUALS },
    isDeleted: { value: null, matchMode: FilterMatchMode.EQUALS }
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

const editDialog = reactive({
    visible: false,
    message: null,
    content: '',
    embedJson: '[]',
    reason: '',
    existingAttachments: []
});

const deleteDialog = reactive({
    visible: false,
    message: null,
    reason: ''
});

const sendModeOptions = computed(() => [
    { label: t('manage.botPosted.modeSend'), value: 'send' },
    { label: t('manage.botPosted.modeReply'), value: 'reply' }
]);

const statusOptions = computed(() => [
    { label: t('manage.botPosted.statusActive'), value: false },
    { label: t('manage.botPosted.statusDeleted'), value: true }
]);

const loadingAll = computed(() => loading.value || loadingOptions.value);

const parsedEditEmbeds = computed(() => parseEmbedJsonInput(editDialog.embedJson));

const editPreviewEmbeds = computed(() =>
    parsedEditEmbeds.value.ok ? parsedEditEmbeds.value.embeds : []
);

const editPreviewError = computed(() => {
    if (!editDialog.embedJson.trim() || editDialog.embedJson.trim() === '[]') {
        return null;
    }
    if (!parsedEditEmbeds.value.ok) {
        return t(`manage.send.embedErrors.${parsedEditEmbeds.value.error}`);
    }
    return null;
});

const canSaveEdit = computed(() => {
    if (!editDialog.message || saving.value) {
        return false;
    }
    const hasContent = Boolean(editDialog.content.trim());
    const hasEmbeds = parsedEditEmbeds.value.ok && parsedEditEmbeds.value.embeds.length > 0;
    const hasNewAttachments = hasAttachments.value;
    if (!hasContent && !hasEmbeds && !hasNewAttachments) {
        return false;
    }
    if (editDialog.embedJson.trim() && editDialog.embedJson.trim() !== '[]' && !parsedEditEmbeds.value.ok) {
        return false;
    }
    return true;
});

const attachmentsChanged = computed(() => {
    if (hasAttachments.value) {
        return true;
    }
    const currentKeys = new Set(editDialog.existingAttachments.map(attachmentKey));
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

function sendModeLabel(mode) {
    return mode === 'reply' ? t('manage.botPosted.modeReply') : t('manage.botPosted.modeSend');
}

function messagePreview(message) {
    const text = message.content?.trim();
    if (text) {
        return text.length > 80 ? `${text.slice(0, 77)}...` : text;
    }
    if (message.attachments?.length) {
        return t('manage.botPosted.attachmentCount', { count: message.attachments.length });
    }
    if (message.embeds?.length) {
        const title = message.embeds[0]?.title?.trim();
        if (title) {
            return `[Embed] ${title}`;
        }
        return t('manage.botPosted.embedOnly');
    }
    return '—';
}

function messageDiscordUrl(message) {
    return `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.messageId}`;
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
    editDialog.existingAttachments = editDialog.existingAttachments.filter(
        (entry) => attachmentKey(entry) !== key
    );
}

function resetEditAttachments() {
    clearAttachments();
    initialExistingAttachmentKeys.value = new Set();
    editDialog.existingAttachments = [];
}

function buildEditEmbedsPayload() {
    if (editDialog.embedJson.trim() && editDialog.embedJson.trim() !== '[]') {
        return parsedEditEmbeds.value.ok ? parsedEditEmbeds.value.payload : [];
    }
    return [];
}

function actionErrorMessage(error) {
    const key = `manage.botPosted.errors.${error}`;
    const translated = t(key);
    return translated === key ? t('manage.botPosted.actionFailed') : translated;
}

async function loadMessages() {
    loading.value = true;
    try {
        const data = await apiFetch('/api/bot-messages');
        messages.value = data.messages ?? [];
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

function openEdit(message) {
    if (message.isDeleted) {
        return;
    }
    resetEditAttachments();
    editDialog.message = message;
    editDialog.content = message.content ?? '';
    editDialog.embedJson = embedsToJson(message.embeds);
    editDialog.reason = '';
    editDialog.existingAttachments = [...(message.attachments ?? [])];
    initialExistingAttachmentKeys.value = new Set(
        editDialog.existingAttachments.map(attachmentKey)
    );
    editDialog.visible = true;
}

function openDelete(message) {
    if (message.isDeleted) {
        return;
    }
    deleteDialog.message = message;
    deleteDialog.reason = '';
    deleteDialog.visible = true;
}

async function saveEdit() {
    if (!canSaveEdit.value || !editDialog.message) {
        return;
    }

    saving.value = true;
    try {
        const embedsPayload = buildEditEmbedsPayload();
        let updated;

        if (attachmentsChanged.value) {
            const formData = new FormData();
            formData.append('content', editDialog.content);
            formData.append('embeds', JSON.stringify(embedsPayload));
            formData.append('replaceAttachments', 'true');
            if (editDialog.reason.trim()) {
                formData.append('reason', editDialog.reason.trim());
            }
            for (const entry of newAttachments.value) {
                formData.append('attachments', entry.file);
            }

            updated = await apiFetch(`/api/bot-messages/${editDialog.message.messageId}`, {
                method: 'PATCH',
                body: formData
            });
        } else {
            updated = await apiFetch(`/api/bot-messages/${editDialog.message.messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: editDialog.content,
                    embeds: embedsPayload,
                    reason: editDialog.reason.trim() || undefined
                })
            });
        }

        const index = messages.value.findIndex((entry) => entry.messageId === updated.messageId);
        if (index !== -1) {
            messages.value[index] = updated;
        }

        toast.add({
            severity: 'success',
            summary: t('manage.botPosted.updateSuccess'),
            life: 4000
        });
        editDialog.visible = false;
        resetEditAttachments();
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

async function confirmDelete() {
    if (!deleteDialog.message) {
        return;
    }

    deleting.value = true;
    try {
        const updated = await apiFetch(`/api/bot-messages/${deleteDialog.message.messageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: deleteDialog.reason.trim() || undefined
            })
        });

        const index = messages.value.findIndex((entry) => entry.messageId === updated.messageId);
        if (index !== -1) {
            messages.value[index] = updated;
        }

        toast.add({
            severity: 'success',
            summary: t('manage.botPosted.deleteSuccess'),
            life: 4000
        });
        deleteDialog.visible = false;
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
        sendMode: { value: null, matchMode: FilterMatchMode.EQUALS },
        isDeleted: { value: null, matchMode: FilterMatchMode.EQUALS }
    };
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
                :value="messages"
                dataKey="messageId"
                paginator
                :rows="15"
                :rowsPerPageOptions="[10, 15, 25, 50]"
                :loading="loadingAll"
                :globalFilterFields="['messageId', 'channelId', 'content', 'postedByUserId']"
                :rowHover="true"
                showGridlines
                responsiveLayout="scroll"
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

                <Column field="messageId" :header="t('manage.messages.messageId')" style="min-width: 12rem">
                    <template #body="{ data }">
                        <a
                            :href="messageDiscordUrl(data)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="font-mono text-sm message-link"
                        >
                            {{ data.messageId }}
                        </a>
                    </template>
                </Column>

                <Column :header="t('manage.messages.channel')" style="min-width: 10rem">
                    <template #body="{ data }">
                        {{ formatChannelName(data.channelId) }}
                    </template>
                </Column>

                <Column field="sendMode" :header="t('manage.botPosted.sendMode')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag :value="sendModeLabel(data.sendMode)" severity="secondary" />
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <Select
                            v-model="filterModel.value"
                            :options="sendModeOptions"
                            optionLabel="label"
                            optionValue="value"
                            :placeholder="t('common.any')"
                            showClear
                            class="w-full"
                            @change="filterCallback()"
                        />
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
                        {{ formatDate(data.createdAt) }}
                    </template>
                </Column>

                <Column field="updatedAt" :header="t('manage.botPosted.updatedAt')" style="min-width: 11rem">
                    <template #body="{ data }">
                        {{ formatDate(data.updatedAt) }}
                    </template>
                </Column>

                <Column field="isDeleted" :header="t('manage.botPosted.status')" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag
                            :value="data.isDeleted ? t('manage.botPosted.statusDeleted') : t('manage.botPosted.statusActive')"
                            :severity="data.isDeleted ? 'danger' : 'success'"
                        />
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <Select
                            v-model="filterModel.value"
                            :options="statusOptions"
                            optionLabel="label"
                            optionValue="value"
                            :placeholder="t('common.any')"
                            showClear
                            class="w-full"
                            @change="filterCallback()"
                        />
                    </template>
                </Column>

                <Column :header="t('manage.botPosted.actions')" style="min-width: 9rem">
                    <template #body="{ data }">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                icon="pi pi-pencil"
                                severity="secondary"
                                text
                                rounded
                                :disabled="data.isDeleted || saving || deleting"
                                @click="openEdit(data)"
                            />
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                text
                                rounded
                                :disabled="data.isDeleted || saving || deleting"
                                @click="openDelete(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </Fluid>

    <Dialog
        v-model:visible="editDialog.visible"
        modal
        :header="t('manage.botPosted.editDialogTitle')"
        :style="{ width: 'min(72rem, 96vw)' }"
        :closable="!saving"
    >
        <div class="grid grid-cols-12 gap-6" @paste="onEditPaste">
            <div class="col-span-12 xl:col-span-6 flex flex-col gap-4">
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
                        :disabled="saving || attachmentCount >= maxAttachments"
                        @change="onFileInputChange"
                    />
                    <div class="flex flex-wrap gap-2">
                        <Button
                            :label="t('manage.send.addAttachment')"
                            icon="pi pi-paperclip"
                            severity="secondary"
                            outlined
                            :disabled="saving || attachmentCount >= maxAttachments"
                            @click="openFilePicker"
                        />
                    </div>
                    <small class="text-muted-color">{{ t('manage.botPosted.editAttachmentHint') }}</small>
                    <div v-if="editDialog.existingAttachments.length" class="attachment-list">
                        <div
                            v-for="attachment in editDialog.existingAttachments"
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
                                :disabled="saving"
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
                                :disabled="saving"
                                @click="removeAttachment(entry.id)"
                            />
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit-content">{{ t('manage.send.textContent') }}</label>
                    <Textarea
                        id="edit-content"
                        v-model="editDialog.content"
                        rows="10"
                        class="w-full font-mono"
                        :disabled="saving"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit-embed-json">{{ t('manage.send.embedJson') }}</label>
                    <Textarea
                        id="edit-embed-json"
                        v-model="editDialog.embedJson"
                        rows="12"
                        class="w-full font-mono text-sm"
                        :disabled="saving"
                    />
                    <small class="text-muted-color">{{ t('manage.send.embedJsonHint') }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit-reason">{{ t('manage.send.reasonOptional') }}</label>
                    <InputText
                        id="edit-reason"
                        v-model="editDialog.reason"
                        :placeholder="t('manage.messages.reasonAuditPlaceholder')"
                        class="w-full"
                        :disabled="saving"
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
                        v-else-if="!editDialog.content.trim() && (!editDialog.embedJson.trim() || editDialog.embedJson.trim() === '[]') && !newAttachments.length && !editDialog.existingAttachments.length"
                        class="preview-empty"
                    >
                        {{ t('manage.botPosted.previewEmpty') }}
                    </div>
                    <template v-else>
                        <DiscordEmbedPreview :content="editDialog.content" :embeds="editPreviewEmbeds" />
                        <div v-if="newAttachments.length || editDialog.existingAttachments.length" class="preview-attachments">
                            <div class="font-medium text-sm mb-2">{{ t('manage.send.attachments') }}</div>
                            <div class="attachment-preview-grid">
                                <div
                                    v-for="attachment in editDialog.existingAttachments"
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
            <Button
                :label="t('manage.botPosted.cancel')"
                severity="secondary"
                outlined
                :disabled="saving"
                @click="editDialog.visible = false"
            />
            <Button
                :label="t('manage.botPosted.save')"
                icon="pi pi-check"
                :loading="saving"
                :disabled="!canSaveEdit"
                @click="saveEdit"
            />
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
                {{ t('manage.botPosted.deleteDialogWarning') }}
            </Message>

            <div class="flex flex-col gap-2">
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
