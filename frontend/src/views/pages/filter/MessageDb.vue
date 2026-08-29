<script setup>
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { DELETE_MESSAGE_SECONDS_OPTIONS } from '@/utils/filterDefaults';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

const toast = useToast();
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

const filteredOnlyOptions = [
    { label: 'Filtered only', value: true },
    { label: 'All messages', value: false }
];

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

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function truncateContent(message) {
    const text = message.cleanContent || message.content || '';
    if (!text) {
        return '(no text content)';
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
        tags.push({ label: 'Word', severity: 'danger' });
    }
    if (message.dupliFilter?.isFiltered) {
        tags.push({ label: 'Duplicate', severity: 'warn' });
    }
    if (message.moderationFilter?.isFiltered) {
        tags.push({ label: 'Moderation', severity: 'info' });
    }
    return tags;
}

function measureCommandLabel(command) {
    switch (command) {
        case 'delete':
            return 'Delete';
        case 'ban':
            return 'Ban';
        case 'kick':
            return 'Kick';
        case 'role':
            return 'Role';
        default:
            return 'Failed';
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
            return entry.deleteDetail.isDeleted ? 'Message deleted' : 'Delete failed';
        }
    }
    if (entry.command === 'ban' || (entry.command === 'none' && entry.banDetail)) {
        const detail = entry.banDetail;
        return detail ? `Reason: ${detail.reason || '—'} / Delete messages: ${detail.deleteMessageSeconds}s` : '—';
    }
    if (entry.command === 'kick' || (entry.command === 'none' && entry.kickDetail)) {
        const detail = entry.kickDetail;
        return detail ? `Reason: ${detail.reason || '—'} / Kick seconds: ${detail.kickSeconds}` : '—';
    }
    if (entry.command === 'role' || (entry.command === 'none' && entry.roleDetail)) {
        const roleId = entry.roleDetail?.roleId;
        return roleId ? `Role: ${roleNameById.value.get(roleId) ?? roleId}` : '—';
    }
    return '—';
}

function operatorLabel(userId) {
    return memberNameById.value.get(userId) ?? userId;
}

async function loadMessages() {
    loading.value = true;
    try {
        messages.value = await apiFetch('/api/message');
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Load failed',
            detail: 'Could not fetch stored messages.',
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
            summary: 'Not filtered',
            detail: 'Manual measures can only be applied to filtered messages.',
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
            summary: 'Action recorded',
            detail: 'The measure was applied and saved to the message record.',
            life: 3000
        });
    } catch (error) {
        if (error.handled || error.message === 'invalid_reason') {
            toast.add({
                severity: 'warn',
                summary: 'Validation',
                detail: 'Reason is required.',
                life: 3000
            });
            return;
        }
        if (error.message === 'invalid_role_id') {
            toast.add({
                severity: 'warn',
                summary: 'Validation',
                detail: 'Select a role first.',
                life: 3000
            });
            return;
        }

        toast.add({
            severity: 'error',
            summary: 'Action failed',
            detail: error.data?.banError || error.data?.kickError || error.data?.roleError || error.data?.deleteError || 'Could not complete the measure.',
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
                <div class="font-semibold text-xl">Message DB</div>
                <p class="text-muted-color m-0 mt-1">
                    Review filtered messages stored by the bot and track measures taken against each author.
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
                        <InputText v-model="filters.global.value" placeholder="Search messages" />
                    </IconField>
                </div>
            </template>

            <template #empty>No stored messages found.</template>
            <template #loading>Loading messages. Please wait.</template>

            <Column field="createdAt" header="Posted" style="min-width: 11rem" sortable>
                <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
            </Column>

            <Column header="Author" style="min-width: 14rem">
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

            <Column header="Channel" style="min-width: 9rem">
                <template #body="{ data }">{{ channelLabel(data.channelId) }}</template>
            </Column>

            <Column header="Content" style="min-width: 18rem">
                <template #body="{ data }">
                    <span class="line-clamp-2">{{ truncateContent(data) }}</span>
                </template>
            </Column>

            <Column header="Filters" style="min-width: 12rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag v-for="tag in filterTags(data)" :key="tag.label" :value="tag.label" :severity="tag.severity" />
                        <span v-if="!filterTags(data).length" class="text-muted-color">—</span>
                    </div>
                </template>
            </Column>

            <Column field="isMeasured" header="Measures" style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag :value="data.isMeasured ? `${data.measuredMessage?.length ?? 0} recorded` : 'None'" :severity="data.isMeasured ? 'success' : 'secondary'" />
                </template>
            </Column>

            <Column field="isDeleted" header="Deleted" style="min-width: 7rem">
                <template #body="{ data }">
                    <Tag :value="data.isDeleted ? 'Yes' : 'No'" :severity="data.isDeleted ? 'danger' : 'secondary'" />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="detailDialog.visible"
        modal
        header="Message details"
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
                {{ detailDialog.message.cleanContent || detailDialog.message.content || '(no text content)' }}
            </div>

            <div>
                <div class="font-semibold mb-2">Filter results</div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">Word</div>
                        <Tag
                            :value="detailDialog.message.wordFilter?.isFiltered ? 'Triggered' : 'Passed'"
                            :severity="detailDialog.message.wordFilter?.isFiltered ? 'danger' : 'success'"
                        />
                        <div v-if="detailDialog.message.wordFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            {{ detailDialog.message.wordFilter.filteredWords.join(', ') || '—' }}
                            ({{ detailDialog.message.wordFilter.filteredWordCount }})
                        </div>
                    </div>
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">Duplicate</div>
                        <Tag
                            :value="detailDialog.message.dupliFilter?.isFiltered ? 'Triggered' : 'Passed'"
                            :severity="detailDialog.message.dupliFilter?.isFiltered ? 'warn' : 'success'"
                        />
                        <div v-if="detailDialog.message.dupliFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            Recent count: {{ detailDialog.message.dupliFilter.messageCount }}
                        </div>
                    </div>
                    <div class="col-span-12 md:col-span-4 rounded-border border border-surface p-3">
                        <div class="font-medium mb-1">Moderation</div>
                        <Tag
                            :value="detailDialog.message.moderationFilter?.isFiltered ? 'Triggered' : 'Passed'"
                            :severity="detailDialog.message.moderationFilter?.isFiltered ? 'info' : 'success'"
                        />
                        <div v-if="detailDialog.message.moderationFilter?.isFiltered" class="text-sm text-muted-color mt-2">
                            Flagged results: {{ detailDialog.message.moderationFilter.messageCount }}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div class="font-semibold mb-2">Measure history</div>
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
                        <div class="text-sm text-muted-color mt-1">Operator: {{ operatorLabel(entry.operationUserId) }}</div>
                    </div>
                </div>
                <Message v-else severity="secondary" :closable="false">No measures have been recorded for this message yet.</Message>
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
        :header="actionDialog.type === 'delete' ? 'Delete message' : actionDialog.type === 'ban' ? 'Ban author' : actionDialog.type === 'kick' ? 'Kick author' : 'Give role'"
        :style="{ width: '32rem' }"
        :closable="!submitting"
    >
        <div class="flex flex-col gap-4">
            <Message severity="info" :closable="false">
                This action will be executed on Discord and recorded in the message DB.
            </Message>

            <div v-if="actionDialog.type === 'ban' || actionDialog.type === 'kick'" class="flex flex-col gap-2">
                <label for="message-action-reason">Reason</label>
                <Textarea id="message-action-reason" v-model="actionDialog.reason" rows="4" class="w-full" :disabled="submitting" />
            </div>

            <div v-if="actionDialog.type === 'ban'" class="flex flex-col gap-2">
                <label for="message-ban-delete-seconds">Delete recent messages</label>
                <Select
                    id="message-ban-delete-seconds"
                    v-model="actionDialog.deleteMessageSeconds"
                    :options="DELETE_MESSAGE_SECONDS_OPTIONS"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :disabled="submitting"
                />
            </div>

            <div v-if="actionDialog.type === 'role'" class="flex flex-col gap-2">
                <label for="message-action-role">Role</label>
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
