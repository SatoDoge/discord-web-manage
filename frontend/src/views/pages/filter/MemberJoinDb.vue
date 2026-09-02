<script setup>
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { MODERATION_CATEGORIES } from '@/utils/filterDefaults';
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const {
    roleOptions,
    memberNameById,
    loading: loadingOptions,
    loadDiscordOptions
} = useDiscordOptions();

const events = ref([]);
const loading = ref(true);
const submitting = ref(false);
const detailDialog = reactive({
    visible: false,
    event: null
});

const actionDialog = reactive({
    visible: false,
    type: 'ban',
    reason: '',
    roleId: null
});

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const showFilteredOnly = ref(true);

const filteredOnlyOptions = computed(() => [
    { label: t('filter.memberJoinDb.filteredOnly'), value: true },
    { label: t('filter.memberJoinDb.allJoins'), value: false }
]);

const tableEvents = computed(() => {
    if (!showFilteredOnly.value) {
        return events.value;
    }
    return events.value.filter((entry) => entry.isFiltered);
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
        case 'ban':
            return t('filter.memberJoinDb.actionBanTitle');
        case 'kick':
            return t('filter.memberJoinDb.actionKickTitle');
        case 'role':
            return t('filter.memberJoinDb.actionRoleTitle');
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

function memberLabel(event) {
    return event.displayName ?? event.globalName ?? event.username;
}

function filterTags(event) {
    const tags = [];
    if (event.nameFilter?.isFiltered) {
        tags.push({ label: t('filter.memberJoinDb.tagName'), severity: 'danger' });
    }
    if (event.joinDelayFilter?.isFiltered) {
        tags.push({ label: t('filter.memberJoinDb.tagJoinDelay'), severity: 'warn' });
    }
    if (event.memberProfileModerationFilter?.isFiltered) {
        tags.push({ label: t('filter.memberJoinDb.tagProfileModeration'), severity: 'info' });
    }
    return tags;
}

function measureCommandLabel(command) {
    switch (command) {
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

function moderationCategoryLabel(categoryKey) {
    const category = MODERATION_CATEGORIES.find((entry) => entry.key === categoryKey);
    if (!category) {
        return categoryKey;
    }
    return t(`filter.moderation.categories.${category.i18nKey}`);
}

function moderationScoreRows(result) {
    if (!result?.category_scores) {
        return [];
    }

    return MODERATION_CATEGORIES.map(({ key }) => ({
        key,
        label: moderationCategoryLabel(key),
        score: result.category_scores[key] ?? 0,
        flagged: result.categories?.[key] ?? false
    })).sort((a, b) => b.score - a.score);
}

function formatModerationScore(score) {
    return `${(score * 100).toFixed(1)}%`;
}

async function loadEvents() {
    loading.value = true;
    try {
        events.value = await apiFetch('/api/member-join');
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.loadFailed'),
            detail: t('filter.memberJoinDb.loadFailed'),
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

function openDetail(event) {
    detailDialog.event = event;
    detailDialog.visible = true;
}

function updateDetailEvent(updated) {
    const index = events.value.findIndex((entry) => entry.joinEventId === updated.joinEventId);
    if (index !== -1) {
        events.value[index] = updated;
    }
    if (detailDialog.event?.joinEventId === updated.joinEventId) {
        detailDialog.event = updated;
    }
}

function openActionDialog(type) {
    if (!detailDialog.event?.isFiltered) {
        toast.add({
            severity: 'warn',
            summary: t('filter.memberJoinDb.notFiltered'),
            detail: t('filter.memberJoinDb.notFilteredDetail'),
            life: 3000
        });
        return;
    }

    actionDialog.type = type;
    actionDialog.reason = '';
    actionDialog.roleId = roleOptions.value[0]?.value ?? null;
    actionDialog.visible = true;
}

async function confirmAction() {
    const event = detailDialog.event;
    if (!event) {
        return;
    }

    submitting.value = true;
    const encodedId = encodeURIComponent(event.joinEventId);

    try {
        let updated;

        if (actionDialog.type === 'ban') {
            if (!actionDialog.reason.trim()) {
                throw Object.assign(new Error('invalid_reason'), { handled: true });
            }
            updated = await apiFetch(`/api/member-join/${encodedId}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: actionDialog.reason.trim() })
            });
        } else if (actionDialog.type === 'kick') {
            if (!actionDialog.reason.trim()) {
                throw Object.assign(new Error('invalid_reason'), { handled: true });
            }
            updated = await apiFetch(`/api/member-join/${encodedId}/kick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: actionDialog.reason.trim() })
            });
        } else if (actionDialog.type === 'role') {
            if (!actionDialog.roleId) {
                throw Object.assign(new Error('invalid_role_id'), { handled: true });
            }
            updated = await apiFetch(`/api/member-join/${encodedId}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId: actionDialog.roleId })
            });
        }

        updateDetailEvent(updated);
        actionDialog.visible = false;
        toast.add({
            severity: 'success',
            summary: t('filter.memberJoinDb.actionRecorded'),
            detail: t('filter.memberJoinDb.actionRecordedDetail'),
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
                t('filter.memberJoinDb.actionFailed'),
            life: 5000
        });

        if (error.data && detailDialog.event) {
            try {
                const refreshed = await apiFetch(
                    `/api/member-join/${encodeURIComponent(detailDialog.event.joinEventId)}`
                );
                updateDetailEvent(refreshed);
            } catch {
                // ignore refresh errors
            }
        }
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadEvents()]);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <div class="font-semibold text-xl">{{ t('filter.memberJoinDb.title') }}</div>
                <p class="text-muted-color m-0 mt-1">
                    {{ t('filter.memberJoinDb.description') }}
                </p>
            </div>
            <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || submitting" @click="loadEvents" />
        </div>

        <DataTable
            v-model:filters="filters"
            :value="tableEvents"
            dataKey="joinEventId"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            filterDisplay="menu"
            :loading="loading || loadingOptions"
            :globalFilterFields="['userId', 'username', 'globalName', 'displayName', 'nickname']"
            :rowHover="true"
            showGridlines
            responsiveLayout="scroll"
            @row-click="(e) => openDetail(e.data)"
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
                        <InputText v-model="filters.global.value" :placeholder="t('filter.memberJoinDb.searchPlaceholder')" />
                    </IconField>
                </div>
            </template>

            <template #empty>{{ t('filter.memberJoinDb.empty') }}</template>
            <template #loading>{{ t('filter.memberJoinDb.loading') }}</template>

            <Column field="joinedAt" :header="t('filter.memberJoinDb.joined')" style="min-width: 11rem" sortable>
                <template #body="{ data }">{{ formatDate(data.joinedAt) }}</template>
            </Column>

            <Column :header="t('filter.memberJoinDb.member')" style="min-width: 14rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-3">
                        <img :src="data.avatarURL" :alt="memberLabel(data)" class="user-avatar" />
                        <div class="min-w-0">
                            <div class="font-medium truncate">{{ memberLabel(data) }}</div>
                            <div class="text-muted-color text-sm truncate">@{{ data.username }}</div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column :header="t('filter.memberJoinDb.accountCreated')" style="min-width: 11rem">
                <template #body="{ data }">{{ formatDate(data.accountCreatedAt) }}</template>
            </Column>

            <Column :header="t('filter.memberJoinDb.filters')" style="min-width: 12rem">
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
        </DataTable>
    </div>

    <Dialog
        v-model:visible="detailDialog.visible"
        modal
        :header="t('filter.memberJoinDb.detailTitle')"
        :style="{ width: '56rem' }"
        :breakpoints="{ '960px': '95vw' }"
    >
        <div v-if="detailDialog.event" class="flex flex-col gap-5">
            <div class="flex items-start gap-4">
                <img :src="detailDialog.event.avatarURL" :alt="memberLabel(detailDialog.event)" class="detail-avatar" />
                <div class="min-w-0 flex-1">
                    <div class="font-semibold text-lg">{{ memberLabel(detailDialog.event) }}</div>
                    <div class="text-muted-color">@{{ detailDialog.event.username }} · {{ detailDialog.event.userId }}</div>
                    <div class="text-sm text-muted-color mt-1">
                        {{ t('filter.memberJoinDb.accountCreated') }}: {{ formatDate(detailDialog.event.accountCreatedAt) }}
                        · {{ t('filter.memberJoinDb.joined') }}: {{ formatDate(detailDialog.event.joinedAt) }}
                    </div>
                </div>
            </div>

            <div>
                <div class="font-semibold mb-2">{{ t('filter.messageDb.filterResults') }}</div>
                <div class="flex flex-col gap-4">
                    <div class="rounded-border border border-surface p-4">
                        <div class="flex flex-wrap items-center gap-2 mb-3">
                            <div class="font-medium">{{ t('filter.memberJoinDb.name') }}</div>
                            <Tag
                                :value="detailDialog.event.nameFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                                :severity="detailDialog.event.nameFilter?.isFiltered ? 'danger' : 'success'"
                            />
                        </div>
                        <template v-if="detailDialog.event.nameFilter?.isFiltered">
                            <div class="flex flex-wrap gap-1 mb-2">
                                <Tag
                                    v-for="word in detailDialog.event.nameFilter.matchedWords"
                                    :key="word"
                                    :value="word"
                                    severity="danger"
                                />
                            </div>
                            <div class="text-sm text-muted-color">
                                {{ t('filter.messageDb.matchCount', { count: detailDialog.event.nameFilter.matchCount }) }}
                            </div>
                        </template>
                        <div v-else class="text-sm text-muted-color">{{ t('filter.memberJoinDb.noNameMatches') }}</div>
                    </div>

                    <div class="rounded-border border border-surface p-4">
                        <div class="flex flex-wrap items-center gap-2 mb-3">
                            <div class="font-medium">{{ t('filter.memberJoinDb.joinDelay') }}</div>
                            <Tag
                                :value="detailDialog.event.joinDelayFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                                :severity="detailDialog.event.joinDelayFilter?.isFiltered ? 'warn' : 'success'"
                            />
                        </div>
                        <div v-if="detailDialog.event.joinDelayFilter" class="text-sm">
                            {{
                                t('filter.memberJoinDb.joinDelayDetail', {
                                    age: detailDialog.event.joinDelayFilter.accountAgeSeconds,
                                    required: detailDialog.event.joinDelayFilter.requiredDelaySeconds
                                })
                            }}
                        </div>
                    </div>

                    <div class="rounded-border border border-surface p-4">
                        <div class="flex flex-wrap items-center gap-2 mb-3">
                            <div class="font-medium">{{ t('filter.memberJoinDb.profileModeration') }}</div>
                            <Tag
                                :value="detailDialog.event.memberProfileModerationFilter?.isFiltered ? t('filter.messageDb.triggered') : t('filter.messageDb.passed')"
                                :severity="detailDialog.event.memberProfileModerationFilter?.isFiltered ? 'info' : 'success'"
                            />
                        </div>

                        <div v-if="detailDialog.event.memberProfileModerationDetail?.name" class="mb-4">
                            <div class="text-sm font-medium mb-2">{{ t('filter.memberProfileModeration.checkName') }}</div>
                            <div class="overflow-x-auto">
                                <table class="detail-table w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th>{{ t('filter.messageDb.moderationCategory') }}</th>
                                            <th>{{ t('filter.messageDb.moderationScore') }}</th>
                                            <th>{{ t('filter.messageDb.moderationFlag') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="row in moderationScoreRows(detailDialog.event.memberProfileModerationDetail.name)"
                                            :key="`name-${row.key}`"
                                            :class="{ 'row-exceeded': row.flagged }"
                                        >
                                            <td>{{ row.label }}</td>
                                            <td>{{ formatModerationScore(row.score) }}</td>
                                            <td>
                                                <Tag
                                                    :value="row.flagged ? t('common.yes') : t('common.no')"
                                                    :severity="row.flagged ? 'danger' : 'secondary'"
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div v-else class="text-sm text-muted-color mb-4">{{ t('filter.memberJoinDb.moderationNoName') }}</div>

                        <div v-if="detailDialog.event.memberProfileModerationDetail?.icon">
                            <div class="text-sm font-medium mb-2">{{ t('filter.memberProfileModeration.checkIcon') }}</div>
                            <div class="flex flex-wrap gap-3 items-start mb-2">
                                <img
                                    :src="detailDialog.event.memberProfileModerationDetail.icon.url"
                                    :alt="t('filter.messageDb.moderationImageAlt')"
                                    class="moderation-thumb"
                                />
                                <Tag
                                    v-if="detailDialog.event.memberProfileModerationDetail.icon.moderation"
                                    :value="detailDialog.event.memberProfileModerationDetail.icon.moderation.flagged ? t('filter.messageDb.moderationFlagged') : t('filter.messageDb.moderationNotFlagged')"
                                    :severity="detailDialog.event.memberProfileModerationDetail.icon.moderation.flagged ? 'danger' : 'success'"
                                />
                            </div>
                            <div
                                v-if="detailDialog.event.memberProfileModerationDetail.icon.moderation"
                                class="overflow-x-auto"
                            >
                                <table class="detail-table w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th>{{ t('filter.messageDb.moderationCategory') }}</th>
                                            <th>{{ t('filter.messageDb.moderationScore') }}</th>
                                            <th>{{ t('filter.messageDb.moderationFlag') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="row in moderationScoreRows(detailDialog.event.memberProfileModerationDetail.icon.moderation)"
                                            :key="`icon-${row.key}`"
                                            :class="{ 'row-exceeded': row.flagged }"
                                        >
                                            <td>{{ row.label }}</td>
                                            <td>{{ formatModerationScore(row.score) }}</td>
                                            <td>
                                                <Tag
                                                    :value="row.flagged ? t('common.yes') : t('common.no')"
                                                    :severity="row.flagged ? 'danger' : 'secondary'"
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div v-else class="text-sm text-muted-color">{{ t('filter.memberJoinDb.moderationNoIcon') }}</div>
                    </div>
                </div>
            </div>

            <div>
                <div class="font-semibold mb-2">{{ t('filter.messageDb.measureHistory') }}</div>
                <div v-if="detailDialog.event.measuredMessage?.length" class="flex flex-col gap-3">
                    <div
                        v-for="(entry, index) in detailDialog.event.measuredMessage"
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

            <div v-if="detailDialog.event.isFiltered" class="flex flex-wrap gap-2">
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
                {{ t('filter.memberJoinDb.actionInfo') }}
            </Message>

            <div v-if="actionDialog.type === 'ban' || actionDialog.type === 'kick'" class="flex flex-col gap-2">
                <label for="member-action-reason">{{ t('filter.messageDb.reason') }}</label>
                <Textarea id="member-action-reason" v-model="actionDialog.reason" rows="4" class="w-full" :disabled="submitting" />
            </div>

            <div v-if="actionDialog.type === 'role'" class="flex flex-col gap-2">
                <label for="member-action-role">{{ t('filter.common.role') }}</label>
                <Select
                    id="member-action-role"
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

.detail-table {
    border-collapse: collapse;
}

.detail-table th,
.detail-table td {
    border-bottom: 1px solid var(--p-content-border-color);
    padding: 0.5rem 0.75rem;
    text-align: left;
}

.detail-table th {
    font-weight: 600;
    white-space: nowrap;
}

.detail-table .row-exceeded {
    background: color-mix(in srgb, var(--p-red-500) 8%, transparent);
}

.moderation-thumb {
    width: 4.5rem;
    height: 4.5rem;
    object-fit: cover;
    border-radius: 0.375rem;
    flex-shrink: 0;
}
</style>
