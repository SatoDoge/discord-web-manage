<script setup>
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();

const ROLE_PERMISSIONS = [
    'Administrator',
    'ViewAuditLog',
    'ViewGuildInsights',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'KickMembers',
    'BanMembers',
    'CreateInstantInvite',
    'ChangeNickname',
    'ManageNicknames',
    'ManageEmojisAndStickers',
    'ManageWebhooks',
    'ViewChannel',
    'SendMessages',
    'SendMessagesInThreads',
    'CreatePublicThreads',
    'CreatePrivateThreads',
    'EmbedLinks',
    'AttachFiles',
    'AddReactions',
    'UseExternalEmojis',
    'UseExternalStickers',
    'MentionEveryone',
    'ManageMessages',
    'ManageThreads',
    'ReadMessageHistory',
    'SendTTSMessages',
    'UseApplicationCommands',
    'Connect',
    'Speak',
    'Stream',
    'UseVAD',
    'PrioritySpeaker',
    'MuteMembers',
    'DeafenMembers',
    'MoveMembers',
    'RequestToSpeak',
    'ManageEvents',
    'ModerateMembers'
];

const roles = ref([]);
const loading = ref(true);
const saving = ref(false);
const creating = ref(false);
const deleting = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const sortField = ref('position');
const sortOrder = ref(-1);

const formDialog = reactive({
    visible: false,
    mode: 'create',
    roleId: null,
    name: '',
    colorHex: '',
    hoist: false,
    mentionable: false,
    position: 0,
    reason: '',
    permissions: {},
    isEveryone: false,
    editable: true,
    managed: false
});

const deleteDialog = reactive({
    visible: false,
    role: null,
    reason: ''
});

const isEditMode = computed(() => formDialog.mode === 'edit');
const canEditName = computed(() => !formDialog.isEveryone);

function emptyPermissionMap(enabledFlags = []) {
    const map = {};
    const enabled = new Set(enabledFlags);
    for (const flag of ROLE_PERMISSIONS) {
        map[flag] = enabled.has(flag);
    }
    return map;
}

function selectedPermissions() {
    return ROLE_PERMISSIONS.filter((flag) => formDialog.permissions[flag]);
}

function colorToCss(role) {
    if (role.colorHex) {
        return `#${role.colorHex}`;
    }
    if (role.color) {
        return `#${role.color.toString(16).padStart(6, '0')}`;
    }
    return 'var(--p-surface-400)';
}

function parseColorInput(value) {
    const trimmed = value.trim().replace(/^#/, '');
    if (!trimmed) {
        return null;
    }
    if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
        return undefined;
    }
    return Number.parseInt(trimmed, 16);
}

function errorDetail(error) {
    const code = error?.message;
    if (!code) {
        return t('manage.roles.actionFailed');
    }
    const key = `manage.roles.errors.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
    sortField.value = 'position';
    sortOrder.value = -1;
}

async function loadRoles() {
    loading.value = true;
    try {
        roles.value = await apiFetch('/api/discord/roles');
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.roles.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function openCreateDialog() {
    formDialog.visible = true;
    formDialog.mode = 'create';
    formDialog.roleId = null;
    formDialog.name = '';
    formDialog.colorHex = '';
    formDialog.hoist = false;
    formDialog.mentionable = false;
    formDialog.position = 0;
    formDialog.reason = '';
    formDialog.permissions = emptyPermissionMap();
    formDialog.isEveryone = false;
    formDialog.editable = true;
    formDialog.managed = false;
}

function openEditDialog(role) {
    formDialog.visible = true;
    formDialog.mode = 'edit';
    formDialog.roleId = role.id;
    formDialog.name = role.name ?? '';
    formDialog.colorHex = role.colorHex ?? '';
    formDialog.hoist = Boolean(role.hoist);
    formDialog.mentionable = Boolean(role.mentionable);
    formDialog.position = role.position ?? 0;
    formDialog.reason = '';
    formDialog.permissions = emptyPermissionMap(role.permissions ?? []);
    formDialog.isEveryone = Boolean(role.isEveryone);
    formDialog.editable = Boolean(role.editable);
    formDialog.managed = Boolean(role.managed);
}

function openDeleteDialog(role) {
    deleteDialog.role = role;
    deleteDialog.reason = '';
    deleteDialog.visible = true;
}

async function submitForm() {
    if (saving.value || creating.value) {
        return;
    }
    if (isEditMode.value && !formDialog.editable) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.roles.notEditable'),
            life: 3000
        });
        return;
    }
    if (canEditName.value && !formDialog.name.trim()) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.roles.nameRequired'),
            life: 3000
        });
        return;
    }

    const color = parseColorInput(formDialog.colorHex);
    if (color === undefined) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.roles.invalidColor'),
            life: 3000
        });
        return;
    }

    const body = {
        hoist: formDialog.hoist,
        mentionable: formDialog.mentionable,
        permissions: selectedPermissions(),
        reason: formDialog.reason.trim() || undefined
    };

    if (canEditName.value) {
        body.name = formDialog.name.trim();
    }
    if (color === null) {
        body.color = isEditMode.value ? null : undefined;
    } else {
        body.color = color;
    }
    if (isEditMode.value) {
        body.position = formDialog.position;
    }

    if (isEditMode.value) {
        saving.value = true;
    } else {
        creating.value = true;
    }

    try {
        if (isEditMode.value) {
            await apiFetch(`/api/discord/roles/${formDialog.roleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            toast.add({
                severity: 'success',
                summary: t('toast.saved'),
                detail: t('manage.roles.updateSuccess'),
                life: 3000
            });
        } else {
            const createBody = { ...body };
            if (createBody.color === undefined) {
                delete createBody.color;
            }
            await apiFetch('/api/discord/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createBody)
            });
            toast.add({
                severity: 'success',
                summary: t('toast.saved'),
                detail: t('manage.roles.createSuccess'),
                life: 3000
            });
        }
        formDialog.visible = false;
        await loadRoles();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.roles.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        saving.value = false;
        creating.value = false;
    }
}

async function confirmDelete() {
    if (!deleteDialog.role || deleting.value) {
        return;
    }
    deleting.value = true;
    try {
        await apiFetch(`/api/discord/roles/${deleteDialog.role.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: deleteDialog.reason.trim() || undefined })
        });
        toast.add({
            severity: 'success',
            summary: t('toast.deleted'),
            detail: t('manage.roles.deleteSuccess'),
            life: 3000
        });
        deleteDialog.visible = false;
        if (formDialog.roleId === deleteDialog.role.id) {
            formDialog.visible = false;
        }
        await loadRoles();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.roles.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        deleting.value = false;
    }
}

onMounted(() => {
    void loadRoles();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
                <div class="font-semibold text-xl mb-1">{{ t('manage.roles.title') }}</div>
                <p class="text-muted-color m-0">{{ t('manage.roles.description') }}</p>
            </div>
            <div class="flex gap-2">
                <Button
                    :label="t('manage.roles.create')"
                    icon="pi pi-plus"
                    @click="openCreateDialog"
                />
                <Button
                    :label="t('manage.roles.refresh')"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    :loading="loading"
                    @click="loadRoles"
                />
            </div>
        </div>

        <DataTable
            v-model:filters="filters"
            v-model:sortField="sortField"
            v-model:sortOrder="sortOrder"
            :value="roles"
            :loading="loading"
            dataKey="id"
            paginator
            :rows="20"
            :rowsPerPageOptions="[10, 20, 50]"
            :globalFilterFields="['name', 'id']"
            rowHover
            class="role-table"
            @row-click="(event) => openEditDialog(event.data)"
        >
            <template #header>
                <div class="flex flex-wrap gap-3 items-center justify-between">
                    <IconField>
                        <InputIcon class="pi pi-search" />
                        <InputText
                            v-model="filters.global.value"
                            :placeholder="t('manage.roles.searchPlaceholder')"
                        />
                    </IconField>
                    <Button
                        :label="t('manage.roles.clearFilters')"
                        icon="pi pi-filter-slash"
                        severity="secondary"
                        text
                        @click="clearFilter"
                    />
                </div>
            </template>

            <template #empty>
                <div class="text-center text-muted-color py-6">{{ t('manage.roles.empty') }}</div>
            </template>

            <Column field="name" :header="t('manage.roles.name')" sortable style="min-width: 14rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <span
                            class="role-color-swatch"
                            :style="{ backgroundColor: colorToCss(data) }"
                        />
                        <span class="font-medium">{{ data.name }}</span>
                        <Tag
                            v-if="data.isEveryone"
                            :value="t('manage.roles.everyone')"
                            severity="secondary"
                        />
                        <Tag
                            v-else-if="data.managed"
                            :value="t('manage.roles.managed')"
                            severity="warn"
                        />
                    </div>
                </template>
            </Column>

            <Column field="position" :header="t('manage.roles.position')" sortable style="min-width: 8rem" />

            <Column field="hoist" :header="t('manage.roles.hoist')" style="min-width: 8rem">
                <template #body="{ data }">
                    <span>{{ data.hoist ? t('common.yes') : t('common.no') }}</span>
                </template>
            </Column>

            <Column field="mentionable" :header="t('manage.roles.mentionable')" style="min-width: 8rem">
                <template #body="{ data }">
                    <span>{{ data.mentionable ? t('common.yes') : t('common.no') }}</span>
                </template>
            </Column>

            <Column :header="t('manage.roles.actions')" style="min-width: 10rem">
                <template #body="{ data }">
                    <div class="flex gap-2" @click.stop>
                        <Button
                            icon="pi pi-pencil"
                            severity="secondary"
                            text
                            rounded
                            :aria-label="t('manage.roles.edit')"
                            @click="openEditDialog(data)"
                        />
                        <Button
                            v-if="data.editable && !data.managed && !data.isEveryone"
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            rounded
                            :aria-label="t('manage.roles.delete')"
                            @click="openDeleteDialog(data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="formDialog.visible"
        modal
        :header="isEditMode ? t('manage.roles.editDialogTitle') : t('manage.roles.createDialogTitle')"
        class="w-full max-w-3xl"
        :style="{ width: '44rem' }"
    >
        <div class="flex flex-col gap-5">
            <div v-if="isEditMode" class="flex flex-wrap items-center gap-2">
                <span class="text-muted-color text-sm">{{ formDialog.roleId }}</span>
                <Tag
                    v-if="!formDialog.editable"
                    :value="t('manage.roles.notEditable')"
                    severity="warn"
                />
            </div>

            <div class="grid grid-cols-12 gap-4">
                <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="role-name">{{ t('manage.roles.name') }}</label>
                    <InputText
                        id="role-name"
                        v-model="formDialog.name"
                        :disabled="!canEditName || (isEditMode && !formDialog.editable)"
                    />
                </div>
                <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="role-color">{{ t('manage.roles.color') }}</label>
                    <div class="flex items-center gap-2">
                        <span
                            class="role-color-swatch"
                            :style="{
                                backgroundColor: formDialog.colorHex
                                    ? `#${formDialog.colorHex.replace(/^#/, '')}`
                                    : 'var(--p-surface-400)'
                            }"
                        />
                        <InputText
                            id="role-color"
                            v-model="formDialog.colorHex"
                            :placeholder="t('manage.roles.colorPlaceholder')"
                            :disabled="isEditMode && !formDialog.editable"
                            class="flex-1"
                        />
                    </div>
                </div>
                <div v-if="isEditMode" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="role-position">{{ t('manage.roles.position') }}</label>
                    <InputNumber
                        id="role-position"
                        v-model="formDialog.position"
                        :min="0"
                        showButtons
                        :disabled="!formDialog.editable"
                    />
                </div>
                <div class="col-span-12 md:col-span-6 flex items-center gap-4 flex-wrap">
                    <div class="flex items-center gap-2">
                        <Checkbox
                            v-model="formDialog.hoist"
                            binary
                            inputId="role-hoist"
                            :disabled="isEditMode && !formDialog.editable"
                        />
                        <label for="role-hoist">{{ t('manage.roles.hoist') }}</label>
                    </div>
                    <div class="flex items-center gap-2">
                        <Checkbox
                            v-model="formDialog.mentionable"
                            binary
                            inputId="role-mentionable"
                            :disabled="isEditMode && !formDialog.editable"
                        />
                        <label for="role-mentionable">{{ t('manage.roles.mentionable') }}</label>
                    </div>
                </div>
                <div class="col-span-12 flex flex-col gap-2">
                    <label for="role-reason">{{ t('manage.roles.reasonPlaceholder') }}</label>
                    <InputText
                        id="role-reason"
                        v-model="formDialog.reason"
                        :disabled="isEditMode && !formDialog.editable"
                    />
                </div>
            </div>

            <div>
                <div class="font-semibold mb-3">{{ t('manage.roles.permissions') }}</div>
                <div class="permission-grid grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                        v-for="flag in ROLE_PERMISSIONS"
                        :key="flag"
                        class="flex items-center gap-2"
                    >
                        <Checkbox
                            v-model="formDialog.permissions[flag]"
                            binary
                            :inputId="`role-perm-${flag}`"
                            :disabled="isEditMode && !formDialog.editable"
                        />
                        <label :for="`role-perm-${flag}`" class="text-sm">{{ flag }}</label>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between gap-2 w-full">
                <Button
                    v-if="isEditMode && formDialog.editable && !formDialog.managed && !formDialog.isEveryone"
                    :label="t('manage.roles.delete')"
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    @click="
                        openDeleteDialog({
                            id: formDialog.roleId,
                            name: formDialog.name,
                            editable: formDialog.editable,
                            managed: formDialog.managed,
                            isEveryone: formDialog.isEveryone
                        })
                    "
                />
                <div class="flex gap-2 ml-auto">
                    <Button
                        :label="t('manage.roles.cancel')"
                        severity="secondary"
                        text
                        :disabled="saving || creating"
                        @click="formDialog.visible = false"
                    />
                    <Button
                        :label="isEditMode ? t('manage.roles.save') : t('manage.roles.create')"
                        :icon="isEditMode ? 'pi pi-check' : 'pi pi-plus'"
                        :loading="saving || creating"
                        :disabled="isEditMode && !formDialog.editable"
                        @click="submitForm"
                    />
                </div>
            </div>
        </template>
    </Dialog>

    <Dialog
        v-model:visible="deleteDialog.visible"
        modal
        :header="t('manage.roles.deleteDialogTitle')"
        class="w-full max-w-md"
    >
        <p class="m-0 mb-4">
            {{ t('manage.roles.deleteDialogWarning', { name: deleteDialog.role?.name ?? '' }) }}
        </p>
        <div class="flex flex-col gap-2">
            <label for="delete-role-reason">{{ t('manage.roles.reasonPlaceholder') }}</label>
            <InputText id="delete-role-reason" v-model="deleteDialog.reason" />
        </div>
        <template #footer>
            <Button
                :label="t('manage.roles.cancel')"
                severity="secondary"
                text
                :disabled="deleting"
                @click="deleteDialog.visible = false"
            />
            <Button
                :label="t('manage.roles.delete')"
                icon="pi pi-trash"
                severity="danger"
                :loading="deleting"
                @click="confirmDelete"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.role-table :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
}

.role-color-swatch {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 999px;
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--p-content-border-color) 80%, transparent);
}

.permission-grid {
    max-height: 18rem;
    overflow: auto;
}
</style>
