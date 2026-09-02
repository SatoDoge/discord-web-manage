<script setup>
import { useFilterOptions } from '@/composables/useFilterOptions';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { deleteMessageSecondsOptions } = useFilterOptions();

const members = ref([]);
const selectedMembers = ref([]);
const loading = ref(true);
const submitting = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    accountKind: { value: null, matchMode: FilterMatchMode.EQUALS }
});

const accountKindOptions = computed(() => [
    { label: t('manage.users.accountMember'), value: 'member' },
    { label: t('manage.users.accountAdmin'), value: 'admin' },
    { label: t('manage.users.accountBot'), value: 'bot' }
]);

const deleteMessageOptions = deleteMessageSecondsOptions;

const actionDialog = reactive({
    visible: false,
    type: 'kick',
    reason: '',
    deleteMessageSeconds: 0
});

const selectedCount = computed(() => selectedMembers.value.length);

const dialogTitle = computed(() =>
    actionDialog.type === 'ban' ? t('manage.users.banDialogTitle') : t('manage.users.kickDialogTitle')
);

const dialogSeverity = computed(() => (actionDialog.type === 'ban' ? 'danger' : 'warn'));

async function loadMembers() {
    loading.value = true;
    try {
        const response = await fetch('/api/discord/members', { credentials: 'include' });
        if (!response.ok) {
            throw new Error('failed_to_load');
        }
        members.value = await response.json();
        selectedMembers.value = [];
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.users.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        accountKind: { value: null, matchMode: FilterMatchMode.EQUALS }
    };
}

function openActionDialog(type) {
    if (!selectedMembers.value.length) {
        toast.add({
            severity: 'warn',
            summary: t('toast.noSelection'),
            detail: t('manage.users.noSelectionDetail'),
            life: 3000
        });
        return;
    }

    actionDialog.type = type;
    actionDialog.reason = '';
    actionDialog.deleteMessageSeconds = 0;
    actionDialog.visible = true;
}

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function formatJoinDelay(member) {
    if (!member.accountCreatedAt || !member.joinedAt) {
        return '—';
    }

    const created = Date.parse(member.accountCreatedAt);
    const joined = Date.parse(member.joinedAt);
    if (Number.isNaN(created) || Number.isNaN(joined) || joined < created) {
        return '—';
    }

    const totalSeconds = Math.floor((joined - created) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function displayRoles(member) {
    return (member.roles ?? [])
        .filter((role) => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position);
}

function accountKindLabel(kind) {
    switch (kind) {
        case 'admin':
            return t('manage.users.accountAdmin');
        case 'bot':
            return t('manage.users.accountBot');
        default:
            return t('manage.users.accountMember');
    }
}

function accountKindSeverity(kind) {
    switch (kind) {
        case 'admin':
            return 'warn';
        case 'bot':
            return 'info';
        default:
            return 'success';
    }
}

function failureLabel(failure) {
    const name = failure.displayName || failure.username || failure.userId;
    return `${name} (${failure.userId}): ${failure.error}`;
}

function showModerationResult(type, result) {
    const failureDetail = result.failures?.length
        ? result.failures.map(failureLabel).join('\n')
        : undefined;

    toast.add({
        severity: result.failed > 0 ? 'warn' : 'success',
        summary: type === 'ban' ? t('manage.users.banComplete') : t('manage.users.kickComplete'),
        detail: t('manage.users.resultSummary', { succeeded: result.succeeded, failed: result.failed }) +
            (failureDetail ? `\n${failureDetail}` : ''),
        life: result.failed > 0 ? 10000 : 4000
    });
}

async function confirmAction() {
    if (!actionDialog.reason.trim()) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.users.reasonRequired'),
            life: 3000
        });
        return;
    }

    const userIds = selectedMembers.value.map((member) => member.id);
    const endpoint = actionDialog.type === 'ban' ? '/api/discord/members/ban' : '/api/discord/members/kick';
    const body =
        actionDialog.type === 'ban'
            ? {
                  userIds,
                  reason: actionDialog.reason.trim(),
                  deleteMessageSeconds: actionDialog.deleteMessageSeconds
              }
            : {
                  userIds,
                  reason: actionDialog.reason.trim()
              };

    submitting.value = true;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error ?? 'action_failed');
        }

        actionDialog.visible = false;
        showModerationResult(actionDialog.type, data);
        await loadMembers();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail: error.message === 'invalid_reason' ? t('manage.users.reasonRequired') : t('manage.users.actionFailed'),
            life: 4000
        });
    } finally {
        submitting.value = false;
    }
}

onMounted(loadMembers);
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <div class="font-semibold text-xl">{{ t('manage.users.title') }}</div>
                <p class="text-muted-color m-0 mt-1">{{ t('manage.users.description') }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || submitting" @click="loadMembers" />
                <Button label="Kick Selected" icon="pi pi-sign-out" severity="warn" :disabled="!selectedCount || loading || submitting" @click="openActionDialog('kick')" />
                <Button label="Ban Selected" icon="pi pi-ban" severity="danger" :disabled="!selectedCount || loading || submitting" @click="openActionDialog('ban')" />
            </div>
        </div>

        <DataTable
            v-model:selection="selectedMembers"
            v-model:filters="filters"
            :value="members"
            dataKey="id"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            filterDisplay="menu"
            :loading="loading"
            :globalFilterFields="['id', 'username', 'displayName', 'globalName']"
            :rowHover="true"
            showGridlines
            responsiveLayout="scroll"
        >
            <template #header>
                <div class="flex flex-wrap justify-between gap-3">
                    <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined :disabled="loading" @click="clearFilter" />
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters['global'].value" :placeholder="t('manage.users.searchPlaceholder')" />
                    </IconField>
                </div>
            </template>

            <template #empty>{{ t('manage.users.empty') }}</template>
            <template #loading>{{ t('manage.users.loading') }}</template>

            <Column selectionMode="multiple" headerStyle="width: 3rem" />

            <Column header="ID" style="min-width: 12rem">
                <template #body="{ data }">
                    <span class="font-mono text-sm">{{ data.id }}</span>
                </template>
            </Column>

            <Column :header="t('manage.users.user')" style="min-width: 16rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-3">
                        <img :src="data.guildAvatarURL || data.avatarURL" :alt="data.displayName" class="user-avatar" />
                        <div class="min-w-0">
                            <div class="font-medium truncate">{{ data.displayName }}</div>
                            <div class="text-muted-color text-sm truncate">@{{ data.username }}</div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column field="accountKind" :header="t('manage.users.accountType')" style="min-width: 9rem">
                <template #body="{ data }">
                    <Tag :value="accountKindLabel(data.accountKind)" :severity="accountKindSeverity(data.accountKind)" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="accountKindOptions" optionLabel="label" optionValue="value" :placeholder="t('common.any')" showClear class="w-full" />
                </template>
            </Column>

            <Column field="accountCreatedAt" :header="t('manage.users.accountCreated')" style="min-width: 11rem">
                <template #body="{ data }">
                    {{ formatDate(data.accountCreatedAt) }}
                </template>
            </Column>

            <Column field="joinedAt" :header="t('manage.users.joinedServer')" style="min-width: 11rem">
                <template #body="{ data }">
                    {{ formatDate(data.joinedAt) }}
                </template>
            </Column>

            <Column :header="t('manage.users.roles')" style="min-width: 14rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag
                            v-for="role in displayRoles(data)"
                            :key="role.id"
                            :value="role.name"
                            :style="role.color ? { backgroundColor: role.hexColor, color: '#fff' } : undefined"
                            severity="secondary"
                        />
                        <span v-if="!displayRoles(data).length" class="text-muted-color">—</span>
                    </div>
                </template>
            </Column>

            <Column :header="t('manage.users.joinDelay')" style="min-width: 8rem">
                <template #body="{ data }">
                    {{ formatJoinDelay(data) }}
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog v-model:visible="actionDialog.visible" modal :header="dialogTitle" :style="{ width: '32rem' }" :closable="!submitting">
        <div class="flex flex-col gap-4">
            <Message :severity="dialogSeverity" :closable="false">
                {{
                    actionDialog.type === 'ban'
                        ? t('manage.users.membersWillBeBanned', { count: selectedCount })
                        : t('manage.users.membersWillBeKicked', { count: selectedCount })
                }}
            </Message>

            <div class="flex flex-col gap-2">
                <label for="moderation-reason">{{ t('common.reason') }}</label>
                <Textarea id="moderation-reason" v-model="actionDialog.reason" rows="4" class="w-full" :disabled="submitting" :placeholder="t('manage.users.reasonPlaceholder')" />
            </div>

            <div v-if="actionDialog.type === 'ban'" class="flex flex-col gap-2">
                <label for="delete-message-seconds">{{ t('manage.users.deleteRecentMessages') }}</label>
                <Select
                    id="delete-message-seconds"
                    v-model="actionDialog.deleteMessageSeconds"
                    :options="deleteMessageOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :disabled="submitting"
                />
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" outlined :disabled="submitting" @click="actionDialog.visible = false" />
            <Button
                :label="actionDialog.type === 'ban' ? 'Ban' : 'Kick'"
                :severity="dialogSeverity"
                :loading="submitting"
                @click="confirmAction"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.user-avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}
</style>
