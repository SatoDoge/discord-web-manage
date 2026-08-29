<script setup>
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { useFilterOptions } from '@/composables/useFilterOptions';
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { deleteMessageSecondsOptions } = useFilterOptions();
const {
    roleOptions,
    memberNameById,
    channelNameById,
    loading: loadingOptions,
    loadDiscordOptions
} = useDiscordOptions();

const messages = ref([]);
const loading = ref(true);
const submitting = ref(false);
const detailDialog = reactive({
    visible: false,
    message: null
});

const actionDialog = reactive({
    visible: false,
    type: 'delete',
    reason: '',
    deleteMessageSeconds: 0,
    roleId: null
});

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const showFilteredOnly = ref(true);

const filteredOnlyOptions = computed(() => [
    { label: t('filter.messageDb.filteredOnly'), value: true },
    { label: t('filter.messageDb.allMessages'), value: false }
]);

const tableMessages = computed(() => {
    if (!showFilteredOnly.value) {
        return messages.value;
    }
    return messages.value.filter((message) => message.isFiltered);
});

const roleNameById = computed(() => {
    const map = new Map();
    for (const role of roleOptions.value) {
        map.set(role.value, role.label);
    }
    return map;
});

const actionDialogTitle = computed(() => {
    switch (actionDialog.type) {
        case 'delete':
            return t('filter.messageDb.actionDeleteTitle');
        case 'ban':
            return t('filter.messageDb.actionBanTitle');
        case 'kick':
            return t('filter.messageDb.actionKickTitle');
        case 'role':
            return t('filter.messageDb.actionRoleTitle');
        default:
            return '';
    }
});

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function truncateContent(message) {
    const text = message.cleanContent || message.content || '';
    if (!text) {
        return t('filter.messageDb.noContent');
    }
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function channelLabel(channelId) {
    const name = channelNameById.value.get(channelId);
    return name ? `#${name}` : channelId;
}

function filterTags(message) {
    const tags = [];
    if (message.wordFilter?.isFiltered) {
        tags.push({ label: t('filter.messageDb.tagWord'), severity: 'danger' });
    }
    if (message.dupliFilter?.isFiltered) {
        tags.push({ label: t('filter.messageDb.tagDuplicate'), severity: 'warn' });
    }
    if (message.moderationFilter?.isFiltered) {
        tags.push({ label: t('filter.messageDb.tagModeration'), severity: 'info' });
    }
    return tags;
}

function measureCommandLabel(command) {
    switch (command) {
        case 'delete':
            return t('filter.messageDb.measureDelete');
        case 'ban':
            return t('filter.messageDb.measureBan');
        case 'kick':
            return t('filter.messageDb.measureKick');
        case 'role':
            return t('filter.messageDb.measureRole');
        default:
            return t('filter.messageDb.measureFailed');
    }
}

function measureCommandSeverity(command) {
    switch (command) {
        case 'delete':
            return 'secondary';
        case 'ban':
            return 'danger';
        case 'kick':
            return 'warn';
        case 'role':
            return 'info';
        default:
            return 'contrast';
    }
}

function measureDetailText(entry) {
    if (entry.command === 'delete' || entry.command === 'none') {
        if (entry.deleteDetail) {
            return entry.deleteDetail.isDeleted
                ? t('filter.messageDb.messageDeleted')
                : t('filter.messageDb.deleteFailed');
        }
    }
    if (entry.command === 'ban' || (entry.command === 'none' && entry.banDetail)) {
        const detail = entry.banDetail;
        return detail
            ? t('filter.messageDb.banDetail', {
                  reason: detail.reason || '—',
                  seconds: detail.deleteMessageSeconds
              })
            : '—';
    }
    if (entry.command === 'kick' || (entry.command === 'none' && entry.kickDetail)) {
        const detail = entry.kickDetail;
        return detail
            ? t('filter.messageDb.kickDetail', {
                  reason: detail.reason || '—',
                  seconds: detail.kickSeconds
              })
            : '—';
    }
    if (entry.command === 'role' || (entry.command === 'none' && entry.roleDetail)) {
        const roleId = entry.roleDetail?.roleId;
        return roleId
            ? t('filter.messageDb.roleDetail', {
                  role: roleNameById.value.get(roleId) ?? roleId
              })
            : '—';
    }
    return '—';
}

function operatorLabel(userId) {
    return t('filter.messageDb.operator', {
        name: memberNameById.value.get(userId) ?? userId
    });
}

async function loadMessages() {
    loading.value = true;
    try {
        messages.value = await apiFetch('/api/message');
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.loadFailed'),
            detail: t('filter.messageDb.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
    showFilteredOnly.value = true;
}

function openDetail(message) {
    detailDialog.message = message;
    detailDialog.visible = true;
}

function updateDetailMessage(updated) {
    const index = messages.value.findIndex((entry) => entry.messageId === updated.messageId);
    if (index !== -1) {
        messages.value[index] = updated;
    }
    if (detailDialog.message?.messageId === updated.messageId) {
        detailDialog.message = updated;
    }
}

function openActionDialog(type) {
    if (!detailDialog.message?.isFiltered) {
        toast.add({
            severity: 'warn',
            summary: t('filter.messageDb.notFiltered'),
            detail: t('filter.messageDb.notFilteredDetail'),
            life: 3000
        });
        return;
    }

    actionDialog.type = type;
    actionDialog.reason = '';
    actionDialog.deleteMessageSeconds = 0;
    actionDialog.roleId = roleOptions.value[0]?.value ?? null;
    actionDialog.visible = true;
}

async function confirmAction() {
    const message = detailDialog.message;
    if (!message) {
        return;
    }

    submitting.value = true;
    try {
        let updated;

        if (actionDialog.type === 'delete') {
            updated = await apiFetch(`/api/message/${message.messageId}/delete`, { method: 'POST' });
        } else if (actionDialog.type === 'ban') {
            if (!actionDialog.reason.trim()) {
                throw Object.assign(new Error('invalid_reason'), { handled: true });
            }
            updated = await apiFetch(`/api/message/${message.messageId}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: actionDialog.reason.trim(),
                    deleteMessageSeconds: actionDialog.deleteMessageSeconds
                })
            });
        } else if (actionDialog.type === 'kick') {
            if (!actionDialog.reason.trim()) {
                throw Object.assign(new Error('invalid_reason'), { handled: true });
            }
            updated = await apiFetch(`/api/message/${message.messageId}/kick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: actionDialog.reason.trim(),
                    kickSeconds: 0
                })
            });
        } else if (actionDialog.type === 'role') {
            if (!actionDialog.roleId) {
                throw Object.assign(new Error('invalid_role_id'), { handled: true });
            }
            updated = await apiFetch(`/api/message/${message.messageId}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId: actionDialog.roleId })
            });
        }

        updateDetailMessage(updated);
        actionDialog.visible = false;
        toast.add({
            severity: 'success',
            summary: t('filter.messageDb.actionRecorded'),
            detail: t('filter.messageDb.actionRecordedDetail'),
            life: 3000
        });
    } catch (error) {
        if (error.handled || error.message === 'invalid_reason') {
            toast.add({
                severity: 'warn',
                summary: t('filter.toast.validation'),
                detail: t('filter.messageDb.reasonRequired'),
                life: 3000
            });
            return;
        }
        if (error.message === 'invalid_role_id') {
            toast.add({
                severity: 'warn',
                summary: t('filter.toast.validation'),
                detail: t('filter.messageDb.roleRequired'),
                life: 3000
            });
            return;
        }

        toast.add({
            severity: 'error',
            summary: t('filter.toast.actionFailed'),
            detail:
                error.data?.banError ||
                error.data?.kickError ||
                error.data?.roleError ||
                error.data?.deleteError ||
                t('filter.messageDb.actionFailed'),
            life: 5000
        });

        if (error.data && detailDialog.message) {
            try {
                const refreshed = await apiFetch(`/api/message/${detailDialog.message.messageId}`);
                updateDetailMessage(refreshed);
            } catch {
                // ignore refresh errors
            }
        }
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadMessages()]);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <div class="font-semibold text-xl">{{ t('filter.messageDb.title') }}</div>
                <p class="text-muted-color m-0 mt-1">
                    {{ t('filter.messageDb.description') }}
                </p>
            </div>
            <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || submitting" @click="loadMessages" />
        </div>

        <DataTable
            v-model:filters="filters"
            :value="tableMessages"
            dataKey="messageId"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            filterDisplay="menu"
            :loading="loading || loadingOptions"
            :globalFilterFields="['messageId', 'content', 'cleanContent', 'author.userId', 'author.username', 'author.displayName']"
            :rowHover="true"
            showGridlines
            responsiveLayout="scroll"
            @row-click="(event) => openDetail(event.data)"
            class="cursor-pointer"
        >
            <template #header>
                <div class="flex flex-wrap justify-between gap-3">
                    <div class="flex flex-wrap gap-2 items-center">
                        <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined :disabled="loading" @click="clearFilter" />
                        <Select
                            v-model="showFilteredOnly"
                            :options="filteredOnlyOptions"
                            optionLabel="label"
                            optionValue="value"
                            class="w-48"
                        />
                    </div>
                    <IconField>
                        <InputIcon><i class="pi pi-search" /></InputIcon>
                        <InputText v-model="filters.global.value" :placeholder="t('filter.messageDb.searchPlaceholder')" />
                    </IconField>
                </div>
            </template>

            <template #empty>{{ t('filter.messageDb.empty') }}</template>
            <template #loading>{{ t('filter.messageDb.loading') }}</template>

            <Column field="createdAt" :header="t('filter.messageDb.posted')" style="min-width: 11rem" sortable>
                <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
            </Column>

            <Column :header="t('filter.messageDb.author')" style="min-width: 14rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-3">
                        <img :src="data.author.avatarURL" :alt="data.author.displayName ?? data.author.username" class="user-avatar" />
                        <div class="min-w-0">
                            <div class="font-medium truncate">{{ data.author.displayName ?? data.author.username }}</div>
                            <div class="text-muted-color text-sm truncate">@{{ data.author.username }}</div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column :header="t('filter.messageDb.channel')" style="min-width: 9rem">
                <template #body="{ data }">{{ channelLabel(data.channelId) }}</template>
            </Column>

            <Column :header="t('filter.messageDb.content')" style="min-width: 18rem">
                <template #body="{ data }">
                    <span class="line-clamp-2">{{ truncateContent(data) }}</span>
                </template>
            </Column>

            <Column :header="t('filter.messageDb.filters')" style="min-width: 12rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag v-for="tag in filterTags(data)" :key="tag.label" :value="tag.label" :severity="tag.severity" />
                        <span v-if="!filterTags(data).length" class="text-muted-color">—</span>
                    </div>
                </template>
            </Column>

            <Column field="isMeasured" :header="t('filter.messageDb.measures')" style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag
                        :value="data.isMeasured ? t('filter.messageDb.measuresRecorded', { count: data.measuredMessage?.length ?? 0 }) : t('filter.messageDb.measuresNone')"
                        :severity="data.isMeasured ? 'success' : 'secondary'"
                    />
                </template>
            </Column>

            <Column field="isDeleted" :header="t('filter.messageDb.deleted')" style="min-width: 7rem">
                <template #body="{ data }">
                    <Tag :value="data.isDeleted ? t('filter.messageDb.yes') : t('filter.messageDb.no')" :severity="data.isDeleted ? 'danger' : 'secondary'" />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="detailDialog.visible"
        modal
        :header="t('filter.messageDb.detailTitle')"
        :style="{ width: '48rem' }"
        :breakpoints="{ '960px': '95vw' }"
    >
        <div v-if="detailDialog.message" class="flex flex-col gap-5">
            <div class="flex items-start gap-4">
                <img
                    :src="detailDialog.message.author.avatarURL"
                    :alt="detailDialog.message.author.displayName ?? detailDialog.message.author.username"
                    class="detail-avatar"
                />
                <div class="min-w-0 flex-1">
                    <div class="font-semibold text-lg">
                        {{ detailDialog.message.author.displayName ?? detailDialog.message.author.username }}
                    </div>
                    <div class="text-muted-color">@{{ detailDialog.message.author.username }} · {{ detailDialog.message.author.userId }}</div>
                    <div class="text-sm text-muted-color mt-1">
                        {{ channelLabel(detailDialog.message.channelId) }} · {{ formatDate(detailDialog.message.createdAt) }}
                    </div>
                </div>
            </div>

            <div class="rounded-border border border-surface p-4 whitespace-pre-wrap break-words">
                {{ detailDialog.message.cleanContent || detailDialog.message.content || t('filter.messageDb.noContent') }}
            </div>

            <div>
                <div class="font-semibold mb-2">{{ t('filter.messageDb.filterResults') }}</div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">{{ t('filter.messageDb.word') }}</div>
                        <Tag
                            :value="detailDialog.message.wordFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                            :severity="detailDialog.message.wordFilter?.isFiltered ? 'danger' : 'success'"
                        />
                        <div v-if="detailDialog.message.wordFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            {{ detailDialog.message.wordFilter.filteredWords.join(', ') || '—' }}
                            ({{ detailDialog.message.wordFilter.filteredWordCount }})
                        </div>
                    </div>
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">{{ t('filter.messageDb.duplicate') }}</div>
                        <Tag
                            :value="detailDialog.message.dupliFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                            :severity="detailDialog.message.dupliFilter?.isFiltered ? 'warn' : 'success'"
                        />
                        <div v-if="detailDialog.message.dupliFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            {{ t('filter.messageDb.recentCount', { count: detailDialog.message.dupliFilter.messageCount }) }}
                        </div>
                    </div>
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">{{ t('filter.messageDb.moderation') }}</div>
                        <Tag
                            :value="detailDialog.message.moderationFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                            :severity="detailDialog.message.moderationFilter?.isFiltered ? 'info' : 'success'"
                        />
                        <div v-if="detailDialog.message.moderationFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            {{ t('filter.messageDb.flaggedResults', { count: detailDialog.message.moderationFilter.messageCount }) }}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div class="font-semibold mb-2">{{ t('filter.messageDb.measureHistory') }}</div>
                <div v-if="detailDialog.message.measuredMessage?.length" class="flex flex-col gap-3">
                    <div
                        v-for="(entry, index) in detailDialog.message.measuredMessage"
                        :key="`${entry.measuredAt}-${index}`"
                        class="rounded-border border border-surface p-3"
                    >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <Tag :value="measureCommandLabel(entry.command)" :severity="measureCommandSeverity(entry.command)" />
                            <span class="text-sm text-muted-color">{{ formatDate(entry.measuredAt) }}</span>
                        </div>
                        <div class="text-sm mt-2">{{ measureDetailText(entry) }}</div>
                        <div class="text-sm text-muted-color mt-1">{{ operatorLabel(entry.operationUserId) }}</div>
                    </div>
                </div>
                <Message v-else severity="secondary" :closable="false">{{ t('filter.messageDb.noMeasures') }}</Message>
            </div>

            <div v-if="detailDialog.message.isFiltered" class="flex flex-wrap gap-2">
                <Button label="Delete" icon="pi pi-trash" severity="secondary" :disabled="submitting" @click="openActionDialog('delete')" />
                <Button label="Give role" icon="pi pi-user-plus" severity="info" :disabled="submitting" @click="openActionDialog('role')" />
                <Button label="Kick" icon="pi pi-sign-out" severity="warn" :disabled="submitting" @click="openActionDialog('kick')" />
                <Button label="Ban" icon="pi pi-ban" severity="danger" :disabled="submitting" @click="openActionDialog('ban')" />
            </div>
        </div>
    </Dialog>

    <Dialog
        v-model:visible="actionDialog.visible"
        modal
        :header="actionDialogTitle"
        :style="{ width: '32rem' }"
        :closable="!submitting"
    >
        <div class="flex flex-col gap-4">
            <Message severity="info" :closable="false">
                {{ t('filter.messageDb.actionInfo') }}
            </Message>

            <div v-if="actionDialog.type === 'ban' || actionDialog.type === 'kick'" class="flex flex-col gap-2">
                <label for="message-action-reason">{{ t('filter.messageDb.reason') }}</label>
                <Textarea id="message-action-reason" v-model="actionDialog.reason" rows="4" class="w-full" :disabled="submitting" />
            </div>

            <div v-if="actionDialog.type === 'ban'" class="flex flex-col gap-2">
                <label for="message-ban-delete-seconds">{{ t('filter.messageDb.deleteRecentMessages') }}</label>
                <Select
                    id="message-ban-delete-seconds"
                    v-model="actionDialog.deleteMessageSeconds"
                    :options="deleteMessageSecondsOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :disabled="submitting"
                />
            </div>

            <div v-if="actionDialog.type === 'role'" class="flex flex-col gap-2">
                <label for="message-action-role">{{ t('filter.common.role') }}</label>
                <Select
                    id="message-action-role"
                    v-model="actionDialog.roleId"
                    :options="roleOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :disabled="submitting"
                    filter
                />
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" outlined :disabled="submitting" @click="actionDialog.visible = false" />
            <Button label="Confirm" :loading="submitting" @click="confirmAction" />
        </template>
    </Dialog>
</template>

<style scoped>
.user-avatar,
.detail-avatar {
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.user-avatar {
    width: 2.25rem;
    height: 2.25rem;
}

.detail-avatar {
    width: 3rem;
    height: 3rem;
}

.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
