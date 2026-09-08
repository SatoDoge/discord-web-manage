<script setup>
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();

const CHANNEL_TYPE = {
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    GuildStageVoice: 13,
    GuildForum: 15,
    GuildMedia: 16
};

const COMMON_PERMISSIONS = [
    'ViewChannel',
    'ManageChannels',
    'ManageRoles',
    'ManageWebhooks',
    'CreateInstantInvite',
    'SendMessages',
    'SendMessagesInThreads',
    'CreatePublicThreads',
    'CreatePrivateThreads',
    'EmbedLinks',
    'AttachFiles',
    'AddReactions',
    'UseExternalEmojis',
    'MentionEveryone',
    'ManageMessages',
    'ReadMessageHistory',
    'SendTTSMessages',
    'Connect',
    'Speak',
    'Stream',
    'UseVAD',
    'MuteMembers',
    'DeafenMembers',
    'MoveMembers',
    'PrioritySpeaker'
];

const channels = ref([]);
const roles = ref([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const detailLoading = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    type: { value: null, matchMode: FilterMatchMode.EQUALS }
});

const editDialog = reactive({
    visible: false,
    channelId: null,
    name: '',
    topic: '',
    parentId: null,
    position: 0,
    nsfw: false,
    rateLimitPerUser: 0,
    bitrate: 64000,
    userLimit: 0,
    reason: '',
    permissionOverwrites: [],
    type: CHANNEL_TYPE.GuildText
});

const permissionDialog = reactive({
    visible: false,
    overwriteId: null,
    type: 0,
    isNew: false,
    permissions: {}
});

const deleteDialog = reactive({
    visible: false,
    channel: null,
    reason: ''
});

const typeOptions = computed(() => [
    { label: t('manage.channels.typeText'), value: CHANNEL_TYPE.GuildText },
    { label: t('manage.channels.typeVoice'), value: CHANNEL_TYPE.GuildVoice },
    { label: t('manage.channels.typeCategory'), value: CHANNEL_TYPE.GuildCategory },
    { label: t('manage.channels.typeAnnouncement'), value: CHANNEL_TYPE.GuildAnnouncement },
    { label: t('manage.channels.typeStage'), value: CHANNEL_TYPE.GuildStageVoice },
    { label: t('manage.channels.typeForum'), value: CHANNEL_TYPE.GuildForum },
    { label: t('manage.channels.typeMedia'), value: CHANNEL_TYPE.GuildMedia }
]);

const categoryOptions = computed(() => [
    { label: t('manage.channels.noCategory'), value: null },
    ...channels.value
        .filter((channel) => channel.type === CHANNEL_TYPE.GuildCategory)
        .map((channel) => ({
            label: channel.name,
            value: channel.id
        }))
]);

const roleOptions = computed(() =>
    roles.value.map((role) => ({
        label: role.name,
        value: role.id
    }))
);

const permissionStateOptions = computed(() => [
    { label: t('manage.channels.permInherit'), value: 'inherit' },
    { label: t('manage.channels.permAllow'), value: 'allow' },
    { label: t('manage.channels.permDeny'), value: 'deny' }
]);

function permissionStateClass(state) {
    switch (state) {
        case 'allow':
            return 'perm-state-allow';
        case 'deny':
            return 'perm-state-deny';
        default:
            return 'perm-state-inherit';
    }
}

const isVoiceLike = computed(
    () =>
        editDialog.type === CHANNEL_TYPE.GuildVoice ||
        editDialog.type === CHANNEL_TYPE.GuildStageVoice
);

const isTextLike = computed(
    () =>
        editDialog.type === CHANNEL_TYPE.GuildText ||
        editDialog.type === CHANNEL_TYPE.GuildAnnouncement ||
        editDialog.type === CHANNEL_TYPE.GuildForum ||
        editDialog.type === CHANNEL_TYPE.GuildMedia
);

const canEditParent = computed(() => editDialog.type !== CHANNEL_TYPE.GuildCategory);

function typeLabel(type) {
    const option = typeOptions.value.find((entry) => entry.value === type);
    return option?.label ?? String(type);
}

function typeSeverity(type) {
    switch (type) {
        case CHANNEL_TYPE.GuildVoice:
        case CHANNEL_TYPE.GuildStageVoice:
            return 'info';
        case CHANNEL_TYPE.GuildCategory:
            return 'secondary';
        case CHANNEL_TYPE.GuildForum:
        case CHANNEL_TYPE.GuildMedia:
            return 'warn';
        case CHANNEL_TYPE.GuildAnnouncement:
            return 'success';
        default:
            return 'contrast';
    }
}

function typeIcon(type) {
    switch (type) {
        case CHANNEL_TYPE.GuildVoice:
            return 'pi pi-volume-up';
        case CHANNEL_TYPE.GuildStageVoice:
            return 'pi pi-microphone';
        case CHANNEL_TYPE.GuildCategory:
            return 'pi pi-folder';
        case CHANNEL_TYPE.GuildForum:
            return 'pi pi-comments';
        case CHANNEL_TYPE.GuildAnnouncement:
            return 'pi pi-megaphone';
        default:
            return 'pi pi-hashtag';
    }
}

function overwriteLabel(overwrite) {
    if (overwrite.type === 0) {
        const role = roles.value.find((entry) => entry.id === overwrite.id);
        return role?.name ?? overwrite.id;
    }
    return t('manage.channels.memberOverwrite', { id: overwrite.id });
}

function permissionFlagLabel(flag) {
    return flag;
}

function errorDetail(error) {
    const code = error?.message;
    if (!code) {
        return t('manage.channels.actionFailed');
    }
    const key = `manage.channels.errors.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        type: { value: null, matchMode: FilterMatchMode.EQUALS }
    };
}

async function loadChannels() {
    loading.value = true;
    try {
        const [channelData, roleData] = await Promise.all([
            apiFetch('/api/discord/channels?scope=manage'),
            apiFetch('/api/discord/roles')
        ]);
        channels.value = channelData;
        roles.value = roleData;
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.channels.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function openEditDialog(channel) {
    editDialog.visible = true;
    editDialog.channelId = channel.id;
    detailLoading.value = true;
    try {
        const detail = await apiFetch(`/api/discord/channels/${channel.id}`);
        editDialog.name = detail.name ?? '';
        editDialog.topic = detail.topic ?? '';
        editDialog.parentId = detail.parentId ?? null;
        editDialog.position = detail.position ?? 0;
        editDialog.nsfw = Boolean(detail.nsfw);
        editDialog.rateLimitPerUser = detail.rateLimitPerUser ?? 0;
        editDialog.bitrate = detail.bitrate ?? 64000;
        editDialog.userLimit = detail.userLimit ?? 0;
        editDialog.reason = '';
        editDialog.permissionOverwrites = detail.permissionOverwrites ?? [];
        editDialog.type = detail.type;
    } catch (error) {
        editDialog.visible = false;
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: errorDetail(error) || t('manage.channels.loadDetailFailed'),
            life: 4000
        });
    } finally {
        detailLoading.value = false;
    }
}

async function saveChannel() {
    if (!editDialog.channelId || saving.value) {
        return;
    }
    if (!editDialog.name.trim()) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.channels.nameRequired'),
            life: 3000
        });
        return;
    }

    saving.value = true;
    try {
        const body = {
            name: editDialog.name.trim(),
            position: editDialog.position,
            reason: editDialog.reason.trim() || undefined
        };

        if (canEditParent.value) {
            body.parentId = editDialog.parentId;
        }
        if (isTextLike.value) {
            body.topic = editDialog.topic;
            body.nsfw = editDialog.nsfw;
            body.rateLimitPerUser = editDialog.rateLimitPerUser;
        }
        if (isVoiceLike.value) {
            body.bitrate = editDialog.bitrate;
            body.userLimit = editDialog.userLimit;
            body.nsfw = editDialog.nsfw;
        }

        await apiFetch(`/api/discord/channels/${editDialog.channelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        toast.add({
            severity: 'success',
            summary: t('toast.saved'),
            detail: t('manage.channels.updateSuccess'),
            life: 3000
        });
        editDialog.visible = false;
        await loadChannels();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.channels.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

function openDeleteDialog(channel) {
    deleteDialog.channel = channel;
    deleteDialog.reason = '';
    deleteDialog.visible = true;
}

async function confirmDelete() {
    if (!deleteDialog.channel || deleting.value) {
        return;
    }
    deleting.value = true;
    try {
        await apiFetch(`/api/discord/channels/${deleteDialog.channel.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: deleteDialog.reason.trim() || undefined })
        });
        toast.add({
            severity: 'success',
            summary: t('toast.deleted'),
            detail: t('manage.channels.deleteSuccess'),
            life: 3000
        });
        deleteDialog.visible = false;
        if (editDialog.channelId === deleteDialog.channel.id) {
            editDialog.visible = false;
        }
        await loadChannels();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.channels.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        deleting.value = false;
    }
}

function buildPermissionStateMap(overwrite) {
    const map = {};
    for (const flag of COMMON_PERMISSIONS) {
        if (overwrite?.allow?.includes(flag)) {
            map[flag] = 'allow';
        } else if (overwrite?.deny?.includes(flag)) {
            map[flag] = 'deny';
        } else {
            map[flag] = 'inherit';
        }
    }
    return map;
}

function openPermissionDialog(overwrite = null) {
    permissionDialog.visible = true;
    permissionDialog.isNew = !overwrite;
    permissionDialog.overwriteId = overwrite?.id ?? null;
    permissionDialog.type = overwrite?.type ?? 0;
    permissionDialog.permissions = buildPermissionStateMap(overwrite);
}

function permissionPayloadFromState() {
    const permissions = {};
    for (const [flag, state] of Object.entries(permissionDialog.permissions)) {
        if (state === 'allow') {
            permissions[flag] = true;
        } else if (state === 'deny') {
            permissions[flag] = false;
        } else {
            permissions[flag] = null;
        }
    }
    return permissions;
}

async function savePermissionOverwrite() {
    if (!editDialog.channelId || saving.value) {
        return;
    }
    if (!permissionDialog.overwriteId) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.channels.roleRequired'),
            life: 3000
        });
        return;
    }

    saving.value = true;
    try {
        const detail = await apiFetch(
            `/api/discord/channels/${editDialog.channelId}/permissions/${permissionDialog.overwriteId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: permissionDialog.type,
                    permissions: permissionPayloadFromState(),
                    reason: editDialog.reason.trim() || undefined
                })
            }
        );
        editDialog.permissionOverwrites = detail.permissionOverwrites ?? [];
        permissionDialog.visible = false;
        toast.add({
            severity: 'success',
            summary: t('toast.saved'),
            detail: t('manage.channels.permissionUpdateSuccess'),
            life: 3000
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.channels.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function deletePermissionOverwrite(overwrite) {
    if (!editDialog.channelId || saving.value) {
        return;
    }
    saving.value = true;
    try {
        const detail = await apiFetch(
            `/api/discord/channels/${editDialog.channelId}/permissions/${overwrite.id}`,
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: editDialog.reason.trim() || undefined })
            }
        );
        editDialog.permissionOverwrites = detail.permissionOverwrites ?? [];
        toast.add({
            severity: 'success',
            summary: t('toast.deleted'),
            detail: t('manage.channels.permissionDeleteSuccess'),
            life: 3000
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.channels.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

onMounted(() => {
    void loadChannels();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
                <div class="font-semibold text-xl mb-1">{{ t('manage.channels.title') }}</div>
                <p class="text-muted-color m-0">{{ t('manage.channels.description') }}</p>
            </div>
            <div class="flex gap-2">
                <Button
                    :label="t('manage.channels.refresh')"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    :loading="loading"
                    @click="loadChannels"
                />
            </div>
        </div>

        <DataTable
            v-model:filters="filters"
            :value="channels"
            :loading="loading"
            dataKey="id"
            paginator
            :rows="20"
            :rowsPerPageOptions="[10, 20, 50]"
            filterDisplay="menu"
            :globalFilterFields="['name', 'id', 'parentName']"
            sortField="displayOrder"
            :sortOrder="1"
            rowHover
            class="channel-table"
            @row-click="(event) => openEditDialog(event.data)"
        >
            <template #header>
                <div class="flex flex-wrap gap-3 items-center justify-between">
                    <IconField>
                        <InputIcon class="pi pi-search" />
                        <InputText
                            v-model="filters.global.value"
                            :placeholder="t('manage.channels.searchPlaceholder')"
                        />
                    </IconField>
                    <Button
                        :label="t('manage.channels.clearFilters')"
                        icon="pi pi-filter-slash"
                        severity="secondary"
                        text
                        @click="clearFilter"
                    />
                </div>
            </template>

            <template #empty>
                <div class="text-center text-muted-color py-6">{{ t('manage.channels.empty') }}</div>
            </template>

            <Column field="name" :header="t('manage.channels.name')" sortable style="min-width: 14rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <i :class="typeIcon(data.type)" class="text-muted-color" />
                        <span class="font-medium">{{ data.name }}</span>
                    </div>
                </template>
            </Column>

            <Column field="type" :header="t('manage.channels.type')" sortable style="min-width: 10rem">
                <template #body="{ data }">
                    <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <Select
                        v-model="filterModel.value"
                        :options="typeOptions"
                        optionLabel="label"
                        optionValue="value"
                        :placeholder="t('common.any')"
                        showClear
                        class="w-full"
                        @change="filterCallback()"
                    />
                </template>
            </Column>

            <Column field="parentName" :header="t('manage.channels.category')" sortable style="min-width: 12rem">
                <template #body="{ data }">
                    <span v-if="data.type === CHANNEL_TYPE.GuildCategory" class="text-muted-color">—</span>
                    <span v-else>{{ data.parentName || t('manage.channels.noCategory') }}</span>
                </template>
            </Column>

            <Column field="position" :header="t('manage.channels.position')" style="min-width: 7rem" />

            <Column field="nsfw" :header="t('manage.channels.nsfw')" style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag
                        v-if="data.nsfw"
                        :value="t('common.yes')"
                        severity="danger"
                    />
                    <span v-else class="text-muted-color">{{ t('common.no') }}</span>
                </template>
            </Column>

            <Column :header="t('manage.channels.actions')" style="min-width: 10rem">
                <template #body="{ data }">
                    <div class="flex gap-2" @click.stop>
                        <Button
                            icon="pi pi-pencil"
                            severity="secondary"
                            text
                            rounded
                            :aria-label="t('manage.channels.edit')"
                            @click="openEditDialog(data)"
                        />
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            rounded
                            :aria-label="t('manage.channels.delete')"
                            @click="openDeleteDialog(data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="editDialog.visible"
        modal
        :header="t('manage.channels.editDialogTitle')"
        class="w-full max-w-4xl"
        :style="{ width: '56rem' }"
    >
        <div v-if="detailLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 3rem; height: 3rem" />
        </div>
        <div v-else class="flex flex-col gap-5">
            <div class="flex items-center gap-2">
                <Tag :value="typeLabel(editDialog.type)" :severity="typeSeverity(editDialog.type)" />
                <span class="text-muted-color text-sm">{{ editDialog.channelId }}</span>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-name">{{ t('manage.channels.name') }}</label>
                    <InputText id="channel-name" v-model="editDialog.name" />
                </div>
                <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-position">{{ t('manage.channels.position') }}</label>
                    <InputNumber id="channel-position" v-model="editDialog.position" :min="0" showButtons />
                </div>
                <div v-if="canEditParent" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-category">{{ t('manage.channels.category') }}</label>
                    <Select
                        id="channel-category"
                        v-model="editDialog.parentId"
                        :options="categoryOptions"
                        optionLabel="label"
                        optionValue="value"
                        showClear
                        class="w-full"
                    />
                </div>
                <div v-if="isTextLike || isVoiceLike" class="col-span-12 md:col-span-6 flex items-end gap-2 pb-1">
                    <div class="flex items-center gap-2">
                        <Checkbox v-model="editDialog.nsfw" binary inputId="channel-nsfw" />
                        <label for="channel-nsfw">{{ t('manage.channels.nsfw') }}</label>
                    </div>
                </div>
                <div v-if="isTextLike" class="col-span-12 flex flex-col gap-2">
                    <label for="channel-topic">{{ t('manage.channels.topic') }}</label>
                    <Textarea id="channel-topic" v-model="editDialog.topic" rows="3" autoResize />
                </div>
                <div v-if="isTextLike" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-slowmode">{{ t('manage.channels.slowmode') }}</label>
                    <InputNumber
                        id="channel-slowmode"
                        v-model="editDialog.rateLimitPerUser"
                        :min="0"
                        :max="21600"
                        suffix=" s"
                        showButtons
                    />
                </div>
                <div v-if="isVoiceLike" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-bitrate">{{ t('manage.channels.bitrate') }}</label>
                    <InputNumber
                        id="channel-bitrate"
                        v-model="editDialog.bitrate"
                        :min="8000"
                        :max="384000"
                        :step="1000"
                        showButtons
                    />
                </div>
                <div v-if="isVoiceLike" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                    <label for="channel-user-limit">{{ t('manage.channels.userLimit') }}</label>
                    <InputNumber
                        id="channel-user-limit"
                        v-model="editDialog.userLimit"
                        :min="0"
                        :max="99"
                        showButtons
                    />
                </div>
                <div class="col-span-12 flex flex-col gap-2">
                    <label for="channel-reason">{{ t('common.reason') }}</label>
                    <InputText
                        id="channel-reason"
                        v-model="editDialog.reason"
                        :placeholder="t('manage.channels.reasonPlaceholder')"
                    />
                </div>
            </div>

            <div>
                <div class="flex items-center justify-between mb-3">
                    <div class="font-semibold">{{ t('manage.channels.permissions') }}</div>
                    <Button
                        :label="t('manage.channels.addPermission')"
                        icon="pi pi-plus"
                        size="small"
                        outlined
                        @click="openPermissionDialog()"
                    />
                </div>
                <DataTable
                    :value="editDialog.permissionOverwrites"
                    dataKey="id"
                    size="small"
                    class="text-sm"
                >
                    <template #empty>
                        <div class="text-muted-color py-3">{{ t('manage.channels.noPermissions') }}</div>
                    </template>
                    <Column :header="t('manage.channels.overwriteTarget')">
                        <template #body="{ data }">
                            <div class="flex items-center gap-2">
                                <Tag
                                    :value="
                                        data.type === 0
                                            ? t('manage.channels.overwriteRole')
                                            : t('manage.channels.overwriteMember')
                                    "
                                    :severity="data.type === 0 ? 'info' : 'secondary'"
                                />
                                <span>{{ overwriteLabel(data) }}</span>
                            </div>
                        </template>
                    </Column>
                    <Column :header="t('manage.channels.allow')">
                        <template #body="{ data }">
                            <div v-if="data.allow?.length" class="flex flex-wrap gap-1">
                                <Tag
                                    v-for="flag in data.allow"
                                    :key="`allow-${flag}`"
                                    :value="flag"
                                    severity="success"
                                    class="text-xs"
                                />
                            </div>
                            <span v-else class="text-muted-color">—</span>
                        </template>
                    </Column>
                    <Column :header="t('manage.channels.deny')">
                        <template #body="{ data }">
                            <div v-if="data.deny?.length" class="flex flex-wrap gap-1">
                                <Tag
                                    v-for="flag in data.deny"
                                    :key="`deny-${flag}`"
                                    :value="flag"
                                    severity="danger"
                                    class="text-xs"
                                />
                            </div>
                            <span v-else class="text-muted-color">—</span>
                        </template>
                    </Column>
                    <Column style="width: 8rem">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button
                                    icon="pi pi-pencil"
                                    text
                                    rounded
                                    size="small"
                                    @click="openPermissionDialog(data)"
                                />
                                <Button
                                    icon="pi pi-trash"
                                    text
                                    rounded
                                    size="small"
                                    severity="danger"
                                    @click="deletePermissionOverwrite(data)"
                                />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between w-full">
                <Button
                    :label="t('manage.channels.delete')"
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    :disabled="detailLoading"
                    @click="
                        openDeleteDialog({
                            id: editDialog.channelId,
                            name: editDialog.name,
                            type: editDialog.type
                        })
                    "
                />
                <div class="flex gap-2">
                    <Button
                        :label="t('manage.channels.cancel')"
                        severity="secondary"
                        text
                        @click="editDialog.visible = false"
                    />
                    <Button
                        :label="t('manage.channels.save')"
                        icon="pi pi-check"
                        :loading="saving"
                        :disabled="detailLoading"
                        @click="saveChannel"
                    />
                </div>
            </div>
        </template>
    </Dialog>

    <Dialog
        v-model:visible="permissionDialog.visible"
        modal
        :header="
            permissionDialog.isNew
                ? t('manage.channels.addPermissionTitle')
                : t('manage.channels.editPermissionTitle')
        "
        class="w-full"
        :style="{ width: '40rem' }"
    >
        <div class="flex flex-col gap-4">
            <div v-if="permissionDialog.isNew" class="flex flex-col gap-2">
                <label>{{ t('manage.channels.overwriteRole') }}</label>
                <Select
                    v-model="permissionDialog.overwriteId"
                    :options="roleOptions"
                    optionLabel="label"
                    optionValue="value"
                    filter
                    class="w-full"
                    :placeholder="t('manage.channels.selectRole')"
                />
            </div>
            <div v-else class="text-muted-color text-sm">
                {{ overwriteLabel({ id: permissionDialog.overwriteId, type: permissionDialog.type }) }}
            </div>

            <div class="permission-grid">
                <div
                    v-for="flag in COMMON_PERMISSIONS"
                    :key="flag"
                    class="flex items-center justify-between gap-3 py-2 border-bottom-1 surface-border"
                >
                    <span class="text-sm">{{ permissionFlagLabel(flag) }}</span>
                    <Select
                        v-model="permissionDialog.permissions[flag]"
                        :options="permissionStateOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-9rem permission-state-select"
                        :class="permissionStateClass(permissionDialog.permissions[flag])"
                    />
                </div>
            </div>
        </div>
        <template #footer>
            <Button
                :label="t('manage.channels.cancel')"
                severity="secondary"
                text
                @click="permissionDialog.visible = false"
            />
            <Button
                :label="t('manage.channels.save')"
                icon="pi pi-check"
                :loading="saving"
                @click="savePermissionOverwrite"
            />
        </template>
    </Dialog>

    <Dialog
        v-model:visible="deleteDialog.visible"
        modal
        :header="t('manage.channels.deleteDialogTitle')"
        :style="{ width: '28rem' }"
    >
        <p class="m-0 mb-3">
            {{ t('manage.channels.deleteDialogWarning', { name: deleteDialog.channel?.name }) }}
        </p>
        <div class="flex flex-col gap-2">
            <label for="delete-reason">{{ t('common.reason') }}</label>
            <InputText
                id="delete-reason"
                v-model="deleteDialog.reason"
                :placeholder="t('manage.channels.reasonPlaceholder')"
            />
        </div>
        <template #footer>
            <Button
                :label="t('manage.channels.cancel')"
                severity="secondary"
                text
                @click="deleteDialog.visible = false"
            />
            <Button
                :label="t('manage.channels.delete')"
                icon="pi pi-trash"
                severity="danger"
                :loading="deleting"
                @click="confirmDelete"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.channel-table :deep(.p-datatable-tbody > tr) {
    cursor: pointer;
}

.permission-grid {
    max-height: 22rem;
    overflow: auto;
}

.permission-state-select.perm-state-allow :deep(.p-select-label),
.permission-state-select.perm-state-allow :deep(.p-inputtext) {
    color: #15803d;
    font-weight: 600;
}

.permission-state-select.perm-state-allow {
    border-color: #22c55e !important;
    background: #dcfce7 !important;
}

.permission-state-select.perm-state-deny :deep(.p-select-label),
.permission-state-select.perm-state-deny :deep(.p-inputtext) {
    color: #b91c1c;
    font-weight: 600;
}

.permission-state-select.perm-state-deny {
    border-color: #ef4444 !important;
    background: #fee2e2 !important;
}

.permission-state-select.perm-state-inherit :deep(.p-select-label),
.permission-state-select.perm-state-inherit :deep(.p-inputtext) {
    color: #64748b;
}

.permission-state-select.perm-state-inherit {
    border-color: #94a3b8 !important;
    background: #f1f5f9 !important;
}
</style>
