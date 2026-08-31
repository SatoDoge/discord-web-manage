<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
    filterSummary: {
        type: Object,
        default: null
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const { t } = useI18n();

const totalPending = computed(() => {
    const messagePending = props.filterSummary?.message?.pending ?? 0;
    const joinPending = props.filterSummary?.memberJoin?.pending ?? 0;
    return messagePending + joinPending;
});

const sections = computed(() => [
    {
        key: 'message',
        title: t('dashboard.filterSummary.messageTitle'),
        route: '/filter/messages',
        today: props.filterSummary?.message?.todayFiltered ?? 0,
        week: props.filterSummary?.message?.weekFiltered ?? 0,
        pending: props.filterSummary?.message?.pending ?? 0,
        types: [
            { label: t('dashboard.filterSummary.word'), value: props.filterSummary?.message?.byType?.word ?? 0 },
            { label: t('dashboard.filterSummary.dupli'), value: props.filterSummary?.message?.byType?.dupli ?? 0 },
            { label: t('dashboard.filterSummary.moderation'), value: props.filterSummary?.message?.byType?.moderation ?? 0 }
        ]
    },
    {
        key: 'memberJoin',
        title: t('dashboard.filterSummary.memberJoinTitle'),
        route: '/filter/member/joins',
        today: props.filterSummary?.memberJoin?.todayFiltered ?? 0,
        week: props.filterSummary?.memberJoin?.weekFiltered ?? 0,
        pending: props.filterSummary?.memberJoin?.pending ?? 0,
        types: [
            { label: t('dashboard.filterSummary.name'), value: props.filterSummary?.memberJoin?.byType?.name ?? 0 },
            { label: t('dashboard.filterSummary.joinDelay'), value: props.filterSummary?.memberJoin?.byType?.joinDelay ?? 0 },
            {
                label: t('dashboard.filterSummary.profileModeration'),
                value: props.filterSummary?.memberJoin?.byType?.profileModeration ?? 0
            }
        ]
    }
]);

function formatValue(value) {
    if (props.loading) {
        return '—';
    }
    return value.toLocaleString();
}
</script>

<template>
    <div class="col-span-12 xl:col-span-4">
        <div class="card mb-0 h-full">
            <div class="flex items-start justify-between gap-3 mb-4">
                <div>
                    <div class="font-semibold text-xl mb-1">{{ t('dashboard.filterSummary.title') }}</div>
                    <p class="text-muted-color m-0">{{ t('dashboard.filterSummary.description') }}</p>
                </div>
                <Tag
                    v-if="!loading && totalPending > 0"
                    :value="t('dashboard.filterSummary.pendingCount', { count: totalPending })"
                    severity="danger"
                />
            </div>

            <div class="flex flex-col gap-4">
                <div
                    v-for="section in sections"
                    :key="section.key"
                    class="rounded-border border border-surface p-4"
                >
                    <div class="flex items-center justify-between gap-3 mb-3">
                        <div class="font-semibold">{{ section.title }}</div>
                        <RouterLink :to="section.route" class="text-primary text-sm no-underline hover:underline">
                            {{ t('dashboard.filterSummary.viewAll') }}
                        </RouterLink>
                    </div>

                    <div class="grid grid-cols-3 gap-3 mb-3">
                        <div>
                            <div class="text-muted-color text-sm">{{ t('dashboard.filterSummary.today') }}</div>
                            <div class="font-semibold text-lg">{{ formatValue(section.today) }}</div>
                        </div>
                        <div>
                            <div class="text-muted-color text-sm">{{ t('dashboard.filterSummary.week') }}</div>
                            <div class="font-semibold text-lg">{{ formatValue(section.week) }}</div>
                        </div>
                        <div>
                            <div class="text-muted-color text-sm">{{ t('dashboard.filterSummary.pending') }}</div>
                            <div class="font-semibold text-lg" :class="{ 'text-red-500': section.pending > 0 }">
                                {{ formatValue(section.pending) }}
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <Tag
                            v-for="type in section.types"
                            :key="type.label"
                            :value="`${type.label}: ${formatValue(type.value)}`"
                            severity="secondary"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
