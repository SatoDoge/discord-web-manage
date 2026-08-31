<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
    kpi: {
        type: Object,
        default: null
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const { t } = useI18n();

const cards = computed(() => [
    {
        key: 'totalMembers',
        label: t('dashboard.kpi.totalMembers'),
        detail: t('dashboard.kpi.totalMembersDetail'),
        value: props.kpi?.totalMembers,
        icon: 'pi pi-users',
        color: 'indigo'
    },
    {
        key: 'onlineMembers',
        label: t('dashboard.kpi.onlineMembers'),
        detail: t('dashboard.kpi.onlineMembersDetail'),
        value: props.kpi?.onlineMembers,
        icon: 'pi pi-circle-fill',
        color: 'cyan'
    },
    {
        key: 'todayJoins',
        label: t('dashboard.kpi.todayJoins'),
        detail: t('dashboard.kpi.todayJoinsDetail'),
        value: props.kpi?.todayJoins,
        icon: 'pi pi-user-plus',
        color: 'emerald'
    }
]);

function formatValue(value) {
    if (props.loading || value == null) {
        return '—';
    }
    return value.toLocaleString();
}
</script>

<template>
    <div
        v-for="card in cards"
        :key="card.key"
        class="col-span-12 md:col-span-6 xl:col-span-3"
    >
        <div class="card mb-0 h-full">
            <div class="flex justify-between mb-4">
                <div class="min-w-0 flex-1 pr-3">
                    <span class="block text-muted-color font-medium mb-4">{{ card.label }}</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl truncate">
                        {{ formatValue(card.value) }}
                    </div>
                    <div class="text-muted-color text-sm mt-1 truncate">{{ card.detail }}</div>
                </div>
                <div
                    class="flex items-center justify-center rounded-border shrink-0"
                    :class="`kpi-icon kpi-icon--${card.color}`"
                >
                    <i :class="[card.icon, `kpi-icon__glyph kpi-icon__glyph--${card.color}`]"></i>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.kpi-icon {
    width: 2.5rem;
    height: 2.5rem;
}

.kpi-icon--indigo {
    background: color-mix(in srgb, var(--p-indigo-500) 12%, transparent);
}

.kpi-icon--cyan {
    background: color-mix(in srgb, var(--p-cyan-500) 12%, transparent);
}

.kpi-icon--emerald {
    background: color-mix(in srgb, var(--p-emerald-500) 12%, transparent);
}

.kpi-icon__glyph {
    font-size: 1.25rem !important;
}

.kpi-icon__glyph--indigo {
    color: var(--p-indigo-500);
}

.kpi-icon__glyph--cyan {
    color: var(--p-cyan-500);
}

.kpi-icon__glyph--emerald {
    color: var(--p-emerald-500);
}
</style>
