<script setup>
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { members, loading: loadingMembers, loadDiscordOptions } = useDiscordOptions();

const admins = ref([]);
const loadingAdmins = ref(true);
const submitting = ref(false);
const currentUserId = ref(null);
const selectedMember = ref(null);
const memberSuggestions = ref([]);

const deleteDialog = reactive({
    visible: false,
    user: null
});

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const adminIds = computed(() => new Set(admins.value.map((admin) => admin.id)));

const loading = computed(() => loadingAdmins.value || loadingMembers.value);

const addableMembers = computed(() =>
    members.value.filter((member) => !member.bot && !adminIds.value.has(member.id))
);

function toMemberOption(member) {
    return {
        id: member.id,
        displayName: member.displayName || member.username,
        username: member.username,
        avatarURL: member.guildAvatarURL || member.avatarURL
    };
}

function searchMembers(event) {
    const query = event.query.trim().toLowerCase();

    memberSuggestions.value = addableMembers.value
        .filter((member) => {
            if (!query) {
                return true;
            }

            return (
                member.displayName?.toLowerCase().includes(query) ||
                member.username?.toLowerCase().includes(query) ||
                member.id.includes(query)
            );
        })
        .slice(0, 20)
        .map(toMemberOption);
}

function resolveUserId(value) {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        return value.trim();
    }

    return value.id ?? '';
}

async function loadAdmins() {
    loadingAdmins.value = true;
    try {
        const data = await apiFetch('/api/auth/admin-users');
        admins.value = data.users ?? [];
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('setting.adminUsers.loadFailed'),
            life: 4000
        });
    } finally {
        loadingAdmins.value = false;
    }
}

async function loadCurrentUser() {
    try {
        const user = await apiFetch('/api/user/state');
        currentUserId.value = user.id;
    } catch {
        currentUserId.value = null;
    }
}

async function addAdmin() {
    const userId = resolveUserId(selectedMember.value);
    if (!userId) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('setting.adminUsers.selectMember'),
            life: 3000
        });
        return;
    }

    if (adminIds.value.has(userId)) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('setting.adminUsers.alreadyAdmin'),
            life: 3000
        });
        return;
    }

    submitting.value = true;
    try {
        const data = await apiFetch('/api/auth/admin-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const existingIndex = admins.value.findIndex((admin) => admin.id === data.user.id);
        if (existingIndex === -1) {
            admins.value = [...admins.value, data.user];
        } else {
            const next = [...admins.value];
            next[existingIndex] = data.user;
            admins.value = next;
        }

        selectedMember.value = null;
        memberSuggestions.value = [];

        toast.add({
            severity: 'success',
            summary: t('toast.saved'),
            detail: t('setting.adminUsers.addSuccess'),
            life: 3000
        });
    } catch (error) {
        const detail =
            error.message === 'member_not_found'
                ? t('setting.adminUsers.memberNotFound')
                : error.message === 'invalid_user_id'
                  ? t('setting.adminUsers.invalidUserId')
                  : t('setting.adminUsers.addFailed');

        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail,
            life: 4000
        });
    } finally {
        submitting.value = false;
    }
}

function openDeleteDialog(user) {
    deleteDialog.user = user;
    deleteDialog.visible = true;
}

async function confirmDelete() {
    const user = deleteDialog.user;
    if (!user) {
        return;
    }

    submitting.value = true;
    try {
        await apiFetch(`/api/auth/admin-users/${user.id}`, { method: 'DELETE' });
        admins.value = admins.value.filter((admin) => admin.id !== user.id);
        deleteDialog.visible = false;
        deleteDialog.user = null;

        toast.add({
            severity: 'success',
            summary: t('toast.saved'),
            detail: t('setting.adminUsers.removeSuccess'),
            life: 3000
        });
    } catch (error) {
        const detail =
            error.message === 'admin_not_found'
                ? t('setting.adminUsers.adminNotFound')
                : t('setting.adminUsers.removeFailed');

        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail,
            life: 4000
        });
    } finally {
        submitting.value = false;
    }
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadAdmins(), loadCurrentUser()]);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <div class="font-semibold text-xl">{{ t('setting.adminUsers.title') }}</div>
                <p class="text-muted-color m-0 mt-1">{{ t('setting.adminUsers.description') }}</p>
            </div>
            <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || submitting" @click="loadAdmins" />
        </div>

        <div class="rounded-border border border-surface p-4 mb-5">
            <div class="font-semibold mb-3">{{ t('setting.adminUsers.addTitle') }}</div>
            <div class="flex flex-col md:flex-row gap-3 md:items-end">
                <div class="flex-1 flex flex-col gap-2">
                    <label for="admin-user-search">{{ t('setting.adminUsers.searchLabel') }}</label>
                    <AutoComplete
                        id="admin-user-search"
                        v-model="selectedMember"
                        :suggestions="memberSuggestions"
                        optionLabel="displayName"
                        :placeholder="t('setting.adminUsers.searchPlaceholder')"
                        :disabled="loading || submitting"
                        :forceSelection="false"
                        class="w-full"
                        dropdown
                        @complete="searchMembers"
                    >
                        <template #option="slotProps">
                            <div class="flex items-center gap-3 min-w-0">
                                <img :src="slotProps.option.avatarURL" :alt="slotProps.option.displayName" class="option-avatar" />
                                <div class="min-w-0">
                                    <div class="font-medium truncate">{{ slotProps.option.displayName }}</div>
                                    <div class="text-muted-color text-sm truncate">@{{ slotProps.option.username }} · {{ slotProps.option.id }}</div>
                                </div>
                            </div>
                        </template>
                    </AutoComplete>
                    <small class="text-muted-color">{{ t('setting.adminUsers.searchHint') }}</small>
                </div>
                <Button label="Add" icon="pi pi-user-plus" :loading="submitting" :disabled="loading" @click="addAdmin" />
            </div>
        </div>

        <div class="font-semibold mb-3">{{ t('setting.adminUsers.listTitle') }}</div>

        <DataTable
            v-model:filters="filters"
            :value="admins"
            dataKey="id"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            filterDisplay="menu"
            :loading="loading"
            :globalFilterFields="['id', 'username', 'displayName']"
            :rowHover="true"
            showGridlines
            responsiveLayout="scroll"
        >
            <template #header>
                <div class="flex flex-wrap justify-between gap-3">
                    <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined :disabled="loading" @click="clearFilter" />
                    <IconField>
                        <InputIcon><i class="pi pi-search" /></InputIcon>
                        <InputText v-model="filters.global.value" :placeholder="t('setting.adminUsers.searchTablePlaceholder')" />
                    </IconField>
                </div>
            </template>

            <template #empty>{{ t('setting.adminUsers.empty') }}</template>
            <template #loading>{{ t('setting.adminUsers.loading') }}</template>

            <Column header="ID" style="min-width: 12rem">
                <template #body="{ data }">
                    <span class="font-mono text-sm">{{ data.id }}</span>
                </template>
            </Column>

            <Column :header="t('setting.adminUsers.user')" style="min-width: 16rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-3">
                        <img :src="data.icon" :alt="data.displayName" class="user-avatar" />
                        <div class="min-w-0">
                            <div class="font-medium truncate">{{ data.displayName }}</div>
                            <div class="text-muted-color text-sm truncate">@{{ data.username }}</div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column :header="t('setting.adminUsers.actions')" style="min-width: 8rem">
                <template #body="{ data }">
                    <Button
                        label="Remove"
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        :disabled="submitting"
                        @click="openDeleteDialog(data)"
                    />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="deleteDialog.visible"
        modal
        :header="t('setting.adminUsers.removeDialogTitle')"
        :style="{ width: '32rem' }"
        :closable="!submitting"
    >
        <div class="flex flex-col gap-4">
            <Message severity="warn" :closable="false">
                {{ t('setting.adminUsers.removeDialogWarning', { name: deleteDialog.user?.displayName ?? deleteDialog.user?.username ?? '' }) }}
            </Message>
            <Message v-if="deleteDialog.user?.id === currentUserId" severity="error" :closable="false">
                {{ t('setting.adminUsers.removeSelfWarning') }}
            </Message>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" outlined :disabled="submitting" @click="deleteDialog.visible = false" />
            <Button label="Remove" severity="danger" icon="pi pi-trash" :loading="submitting" @click="confirmDelete" />
        </template>
    </Dialog>
</template>

<style scoped>
.user-avatar,
.option-avatar {
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.user-avatar {
    width: 2.25rem;
    height: 2.25rem;
}

.option-avatar {
    width: 2rem;
    height: 2rem;
}
</style>
