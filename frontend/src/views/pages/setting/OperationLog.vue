<script setup>
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { memberNameById, loading: loadingMembers, loadDiscordOptions } = useDiscordOptions();

const logs = ref([]);
const loading = ref(true);
const detailDialog = reactive({
    visible: false,
    log: null
});

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    category: { value: null, matchMode: FilterMatchMode.EQUALS },
    success: { value: null, matchMode: FilterMatchMode.EQUALS }
});

const categoryOptions = computed(() => [
    { label: t('setting.operationLogs.categorySettings'), value: 'settings' },
    { label: t('setting.operationLogs.categoryMessage'), value: 'message' },
    { label: t('setting.operationLogs.categoryMemberJoin'), value: 'member_join' },
    { label: t('setting.operationLogs.categoryAdminUser'), value: 'admin_user' }
]);

const successOptions = computed(() => [
    { label: t('setting.operationLogs.successOnly'), value: true },
    { label: t('setting.operationLogs.failureOnly'), value: false }
]);

const loadingAll = computed(() => loading.value || loadingMembers.value);

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function actorLabel(actorUserId) {
    return memberNameById.value.get(actorUserId) ?? actorUserId;
}

function categoryLabel(category) {
    const option = categoryOptions.value.find((entry) => entry.value === category);
    return option?.label ?? category;
}

function categorySeverity(category) {
    switch (category) {
        case 'admin_user':
            return 'warn';
        case 'message':
            return 'info';
        case 'member_join':
            return 'danger';
        default:
            return 'secondary';
    }
}

function sourceLabel(source) {
    return source === 'automatic'
        ? t('setting.operationLogs.sourceAutomatic')
        : t('setting.operationLogs.sourceManual');
}

function actorTypeLabel(actorType) {
    return actorType === 'bot'
        ? t('setting.operationLogs.actorBot')
        : t('setting.operationLogs.actorAdmin');
}

function targetLabel(log) {
    if (!log.targetType && !log.targetId) {
        return '—';
    }
    if (log.targetType === 'user' && log.targetId) {
        return `${log.targetType}: ${actorLabel(log.targetId)}`;
    }
    return [log.targetType, log.targetId].filter(Boolean).join(': ');
}

function formatMetadata(metadata) {
    if (!metadata) {
        return '—';
    }
    return JSON.stringify(metadata, null, 2);
}

async function loadLogs() {
    loading.value = true;
    try {
        const data = await apiFetch('/api/operation-logs');
        logs.value = data.logs ?? [];
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('setting.operationLogs.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function openDetail(log) {
    detailDialog.log = log;
    detailDialog.visible = true;
}

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        category: { value: null, matchMode: FilterMatchMode.EQUALS },
        success: { value: null, matchMode: FilterMatchMode.EQUALS }
    };
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadLogs()]);
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
                <div class="font-semibold text-xl">{{ t('setting.operationLogs.title') }}</div>
                <p class="text-muted-color m-0 mt-1">{{ t('setting.operationLogs.description') }}</p>
            </div>
            <Button
                label="Refresh"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                :disabled="loadingAll"
                @click="loadLogs"
            />
        </div>

        <DataTable
            v-model:filters="filters"
            :value="logs"
            dataKey="logId"
            paginator
            :rows="25"
            :rowsPerPageOptions="[25, 50, 100]"
            filterDisplay="menu"
            :loading="loadingAll"
            :globalFilterFields="['summary', 'action', 'actorUserId', 'targetId', 'errorMessage']"
            :rowHover="true"
            showGridlines
            responsiveLayout="scroll"
            sortField="occurredAt"
            :sortOrder="-1"
        >
            <template #header>
                <div class="flex flex-wrap justify-between gap-3">
                    <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined :disabled="loadingAll" @click="clearFilter" />
                    <IconField>
                        <InputIcon><i class="pi pi-search" /></InputIcon>
                        <InputText v-model="filters.global.value" :placeholder="t('setting.operationLogs.searchPlaceholder')" />
                    </IconField>
                </div>
            </template>

            <template #empty>{{ t('setting.operationLogs.empty') }}</template>
            <template #loading>{{ t('setting.operationLogs.loading') }}</template>

            <Column field="occurredAt" :header="t('setting.operationLogs.occurredAt')" sortable style="min-width: 11rem">
                <template #body="{ data }">
                    <span class="text-sm whitespace-nowrap">{{ formatDate(data.occurredAt) }}</span>
                </template>
            </Column>

            <Column field="actorUserId" :header="t('setting.operationLogs.actor')" style="min-width: 12rem">
                <template #body="{ data }">
                    <div class="min-w-0">
                        <div class="font-medium truncate">{{ actorLabel(data.actorUserId) }}</div>
                        <div class="text-muted-color text-sm truncate font-mono">{{ data.actorUserId }}</div>
                    </div>
                </template>
            </Column>

            <Column
                field="category"
                :header="t('setting.operationLogs.category')"
                :showFilterMatchModes="false"
                style="min-width: 9rem"
            >
                <template #body="{ data }">
                    <Tag :value="categoryLabel(data.category)" :severity="categorySeverity(data.category)" />
                </template>
                <template #filter="{ filterModel }">
                    <Select
                        v-model="filterModel.value"
                        :options="categoryOptions"
                        optionLabel="label"
                        optionValue="value"
                        :placeholder="t('common.any')"
                        showClear
                        class="w-full"
                    />
                </template>
            </Column>

            <Column field="action" :header="t('setting.operationLogs.action')" style="min-width: 10rem">
                <template #body="{ data }">
                    <span class="font-mono text-sm">{{ data.action }}</span>
                </template>
            </Column>

            <Column field="summary" :header="t('setting.operationLogs.summary')" style="min-width: 16rem">
                <template #body="{ data }">
                    <span class="line-clamp-2">{{ data.summary }}</span>
                </template>
            </Column>

            <Column
                field="success"
                :header="t('setting.operationLogs.result')"
                :showFilterMatchModes="false"
                style="min-width: 7rem"
            >
                <template #body="{ data }">
                    <Tag
                        :value="data.success ? t('setting.operationLogs.success') : t('setting.operationLogs.failure')"
                        :severity="data.success ? 'success' : 'danger'"
                    />
                </template>
                <template #filter="{ filterModel }">
                    <Select
                        v-model="filterModel.value"
                        :options="successOptions"
                        optionLabel="label"
                        optionValue="value"
                        :placeholder="t('common.any')"
                        showClear
                        class="w-full"
                    />
                </template>
            </Column>

            <Column :header="t('setting.operationLogs.target')" style="min-width: 12rem">
                <template #body="{ data }">
                    <span class="text-sm">{{ targetLabel(data) }}</span>
                </template>
            </Column>

            <Column :header="t('setting.operationLogs.actions')" style="min-width: 7rem">
                <template #body="{ data }">
                    <Button label="Details" icon="pi pi-eye" text @click="openDetail(data)" />
                </template>
            </Column>
        </DataTable>
    </div>

    <Dialog
        v-model:visible="detailDialog.visible"
        modal
        :header="t('setting.operationLogs.detailTitle')"
        :style="{ width: '42rem' }"
    >
        <div v-if="detailDialog.log" class="flex flex-col gap-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.occurredAt') }}</div>
                    <div>{{ formatDate(detailDialog.log.occurredAt) }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.result') }}</div>
                    <Tag
                        :value="detailDialog.log.success ? t('setting.operationLogs.success') : t('setting.operationLogs.failure')"
                        :severity="detailDialog.log.success ? 'success' : 'danger'"
                    />
                </div>
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.actor') }}</div>
                    <div>{{ actorLabel(detailDialog.log.actorUserId) }}</div>
                    <div class="font-mono text-sm text-muted-color">{{ detailDialog.log.actorUserId }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.actorType') }}</div>
                    <div>{{ actorTypeLabel(detailDialog.log.actorType) }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.category') }}</div>
                    <div>{{ categoryLabel(detailDialog.log.category) }}</div>
                </div>
                <div>
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.source') }}</div>
                    <div>{{ sourceLabel(detailDialog.log.source) }}</div>
                </div>
                <div class="md:col-span-2">
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.action') }}</div>
                    <div class="font-mono text-sm">{{ detailDialog.log.action }}</div>
                </div>
                <div class="md:col-span-2">
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.summary') }}</div>
                    <div>{{ detailDialog.log.summary }}</div>
                </div>
                <div class="md:col-span-2">
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.target') }}</div>
                    <div>{{ targetLabel(detailDialog.log) }}</div>
                </div>
                <div v-if="detailDialog.log.errorMessage" class="md:col-span-2">
                    <div class="text-muted-color text-sm">{{ t('setting.operationLogs.errorMessage') }}</div>
                    <div class="text-red-500">{{ detailDialog.log.errorMessage }}</div>
                </div>
            </div>

            <div>
                <div class="text-muted-color text-sm mb-2">{{ t('setting.operationLogs.metadata') }}</div>
                <pre class="metadata-block">{{ formatMetadata(detailDialog.log.metadata) }}</pre>
            </div>

            <div>
                <div class="text-muted-color text-sm">{{ t('setting.operationLogs.logId') }}</div>
                <div class="font-mono text-sm">{{ detailDialog.log.logId }}</div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.metadata-block {
    margin: 0;
    padding: 0.75rem;
    border-radius: var(--content-border-radius);
    background: var(--surface-100);
    overflow: auto;
    max-height: 16rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}

:global(.app-dark) .metadata-block {
    background: var(--surface-800);
}
</style>
