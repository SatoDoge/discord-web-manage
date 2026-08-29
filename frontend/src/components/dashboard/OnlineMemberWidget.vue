<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const loading = ref(true);
const onlineCount = ref(null);

onMounted(async () => {
    try {
        const response = await fetch('/api/discord/members/online', { credentials: 'include' });
        if (response.ok) {
            const members = await response.json();
            onlineCount.value = Array.isArray(members) ? members.length : 0;
        }
    } finally {
        loading.value = false;
    }
});

const countLabel = computed(() => {
    if (loading.value) {
        return '—';
    }
    if (onlineCount.value == null) {
        return '—';
    }
    return onlineCount.value.toLocaleString();
});

const detailText = computed(() => {
    if (loading.value) {
        return t('dashboard.fetchingOnlineMembers');
    }
    if (onlineCount.value == null) {
        return t('dashboard.onlineMembersFailed');
    }
    return t('dashboard.onlineMembersDetail');
});
</script>

<template>
    <div class="col-span-12 md:col-span-6 xl:col-span-4">
        <div class="card mb-0">
            <div class="flex justify-between mb-4">
                <div class="min-w-0 flex-1 pr-3">
                    <span class="block text-muted-color font-medium mb-4 flex items-center gap-2">
                        <span
                            class="status-dot shrink-0"
                            :class="loading ? 'status-dot--loading' : onlineCount != null ? 'status-dot--online' : 'status-dot--offline'"
                        ></span>
                        {{ t('dashboard.onlineMembers') }}
                    </span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl truncate">{{ countLabel }}</div>
                    <div class="text-muted-color text-sm mt-1 truncate">{{ detailText }}</div>
                </div>
                <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border shrink-0" style="width: 2.5rem; height: 2.5rem">
                    <i class="pi pi-users text-cyan-500 text-xl!"></i>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.status-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
}

.status-dot--online {
    background-color: #22c55e;
}

.status-dot--offline {
    background-color: #ef4444;
}

.status-dot--loading {
    background-color: #94a3b8;
}
</style>
