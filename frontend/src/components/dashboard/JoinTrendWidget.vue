<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
    joinTrend: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const { t, locale } = useI18n();

const chartData = computed(() => ({
    labels: props.joinTrend.map((point) => formatChartLabel(point.date)),
    datasets: [
        {
            label: t('dashboard.joinTrend.joins'),
            data: props.joinTrend.map((point) => point.joins),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
        },
        {
            label: t('dashboard.joinTrend.filteredJoins'),
            data: props.joinTrend.map((point) => point.filteredJoins),
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1
        }
    ]
}));

const chartOptions = computed(() => ({
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom'
        }
    },
    scales: {
        x: {
            ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 7
            }
        },
        y: {
            beginAtZero: true,
            ticks: {
                precision: 0
            }
        }
    }
}));

function formatChartLabel(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    return date.toLocaleDateString(locale.value, {
        month: 'numeric',
        day: 'numeric'
    });
}
</script>

<template>
    <div class="col-span-12 xl:col-span-8">
        <div class="card mb-0 h-full">
            <div class="font-semibold text-xl mb-1">{{ t('dashboard.joinTrend.title') }}</div>
            <p class="text-muted-color m-0 mb-4">{{ t('dashboard.joinTrend.description') }}</p>

            <div v-if="loading" class="chart-placeholder">
                {{ t('dashboard.loading') }}
            </div>
            <div v-else class="chart-container">
                <Chart type="bar" :data="chartData" :options="chartOptions" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.chart-container {
    height: 18rem;
}

.chart-placeholder {
    height: 18rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted-color);
}
</style>
