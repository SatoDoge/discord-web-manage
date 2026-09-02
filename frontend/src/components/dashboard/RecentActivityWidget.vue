<script setup>
import { useI18n } from 'vue-i18n';

const props = defineProps({
    recentActivity: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const { t } = useI18n();

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function activityTypeLabel(type) {
    switch (type) {
        case 'operation_log':
            return t('dashboard.recentActivity.typeOperationLog');
        case 'message_filter':
            return t('dashboard.recentActivity.typeMessageFilter');
        case 'member_join_filter':
            return t('dashboard.recentActivity.typeMemberJoinFilter');
        default:
            return type;
    }
}

function activitySeverity(item) {
    if (item.type === 'operation_log') {
        return item.success === false ? 'danger' : 'info';
    }
    return 'warn';
}

function truncate(text, max = 80) {
    if (!text) {
        return '—';
    }
    return text.length > max ? `${text.slice(0, max)}…` : text;
}
</script>

<template>
    <div class="col-span-12">
        <div class="card mb-0">
            <div class="font-semibold text-xl mb-1">{{ t('dashboard.recentActivity.title') }}</div>
            <p class="text-muted-color m-0 mb-4">{{ t('dashboard.recentActivity.description') }}</p>

            <div v-if="loading" class="activity-empty">{{ t('dashboard.loading') }}</div>
            <div v-else-if="recentActivity.length === 0" class="activity-empty">
                {{ t('dashboard.recentActivity.empty') }}
            </div>
            <div v-else class="flex flex-col gap-3">
                <RouterLink
                    v-for="item in recentActivity"
                    :key="item.id"
                    :to="item.route"
                    class="activity-item no-underline text-inherit"
                >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <Tag :value="activityTypeLabel(item.type)" :severity="activitySeverity(item)" />
                                <span class="font-medium truncate">{{ item.title }}</span>
                            </div>
                            <div class="text-muted-color text-sm line-clamp-2">{{ truncate(item.summary) }}</div>
                        </div>
                        <div class="text-muted-color text-sm whitespace-nowrap">{{ formatDate(item.occurredAt) }}</div>
                    </div>
                </RouterLink>
            </div>
        </div>
    </div>
</template>

<style scoped>
.activity-empty {
    padding: 2rem 0;
    text-align: center;
    color: var(--text-muted-color);
}

.activity-item {
    display: block;
    padding: 0.875rem 1rem;
    border: 1px solid var(--surface-border);
    border-radius: var(--content-border-radius);
    transition: background-color 0.15s ease;
}

.activity-item:hover {
    background: var(--surface-hover);
}
</style>
