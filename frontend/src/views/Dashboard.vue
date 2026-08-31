<script setup>
import FilterSummaryWidget from '@/components/dashboard/FilterSummaryWidget.vue';
import JoinTrendWidget from '@/components/dashboard/JoinTrendWidget.vue';
import KpiCardsWidget from '@/components/dashboard/KpiCardsWidget.vue';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget.vue';
import StatsWidget from '@/components/dashboard/StatsWidget.vue';
import { useDashboardSummary } from '@/composables/useDashboardSummary';
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { summary, loading, loadDashboardSummary } = useDashboardSummary();

onMounted(async () => {
    try {
        await loadDashboardSummary();
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('dashboard.loadFailed'),
            life: 4000
        });
    }
});
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <StatsWidget />
        <KpiCardsWidget :kpi="summary?.kpi" :loading="loading" />
        <JoinTrendWidget :join-trend="summary?.joinTrend ?? []" :loading="loading" />
        <FilterSummaryWidget :filter-summary="summary?.filterSummary" :loading="loading" />
        <RecentActivityWidget :recent-activity="summary?.recentActivity ?? []" :loading="loading" />
    </div>
</template>
