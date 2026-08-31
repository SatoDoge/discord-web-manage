<script setup>
import { useDiscordPresence } from '@/composables/useDiscordPresence';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { formatDiscordActivity } = useDiscordPresence();

/** @type {import('vue').Ref<null | {
 *   isConnected: boolean;
 *   username: string | null;
 *   avatarURL: string | null;
 *   status: string | null;
 *   activities: { name: string; type: number; state: string | null }[] | null;
 * }>} */
const clientStatus = ref(null);
const loading = ref(true);

onMounted(async () => {
    try {
        const response = await fetch('/api/discord/status', { credentials: 'include' });
        if (response.ok) {
            clientStatus.value = await response.json();
        }
    } finally {
        loading.value = false;
    }
});

const isOnline = computed(() => clientStatus.value?.isConnected === true);

const statusLabel = computed(() => {
    if (loading.value) {
        return t('dashboard.loading');
    }
    return isOnline.value ? t('dashboard.online') : t('dashboard.offline');
});

const botName = computed(() => {
    if (loading.value) {
        return '—';
    }
    return clientStatus.value?.username ?? t('dashboard.botUnavailable');
});

const activityText = computed(() => {
    if (loading.value) {
        return t('dashboard.fetchingStatus');
    }
    if (!isOnline.value) {
        return t('dashboard.botNotConnected');
    }

    return formatDiscordActivity(clientStatus.value?.activities?.[0]);
});
</script>

<template>
    <div class="col-span-12 md:col-span-6 xl:col-span-3">
        <div class="card mb-0">
            <div class="flex justify-between mb-4">
                <div class="min-w-0 flex-1 pr-3">
                    <span class="block text-muted-color font-medium mb-4 flex items-center gap-2">
                        <span
                            class="status-dot shrink-0"
                            :class="loading ? 'status-dot--loading' : isOnline ? 'status-dot--online' : 'status-dot--offline'"
                        ></span>
                        {{ statusLabel }}
                    </span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl truncate">{{ botName }}</div>
                    <div class="text-muted-color text-sm mt-1 truncate">{{ activityText }}</div>
                </div>
                <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border shrink-0 overflow-hidden" style="width: 2.5rem; height: 2.5rem">
                    <img v-if="clientStatus?.avatarURL" :src="clientStatus.avatarURL" :alt="botName" class="bot-avatar" />
                    <i v-else class="pi pi-discord text-blue-500 text-xl!"></i>
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

.bot-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
