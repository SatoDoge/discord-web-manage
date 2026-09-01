<script setup>
import { useDiscordPresence } from '@/composables/useDiscordPresence';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { presenceStatusOptions, activityTypeOptions, formatDiscordActivity, formatPresenceStatus } =
    useDiscordPresence();

const loading = ref(true);
const saving = ref(false);
const clearActivity = ref(false);

/** @type {import('vue').Ref<null | {
 *   isConnected: boolean;
 *   username: string | null;
 *   avatarURL: string | null;
 *   status: string | null;
 *   activities: { name: string; type: number; state: string | null }[] | null;
 * }>} */
const clientStatus = ref(null);

const selectedStatus = ref('online');
const activityType = ref(0);
const activityName = ref('');
const activityState = ref('');

const isOnline = computed(() => clientStatus.value?.isConnected === true);
const isCustomActivity = computed(() => activityType.value === 4);

const previewActivityText = computed(() => {
    if (clearActivity.value) {
        return t('bot.presence.noActivity');
    }

    return formatDiscordActivity({
        name: activityName.value.trim(),
        type: activityType.value,
        state: activityState.value.trim() || null
    });
});

const previewStatusLabel = computed(() => formatPresenceStatus(selectedStatus.value));

const selectedStatusOption = computed(
    () => presenceStatusOptions.value.find((option) => option.value === selectedStatus.value) ?? presenceStatusOptions.value[0]
);

function applyStatusToForm(status) {
    clientStatus.value = status;
    selectedStatus.value = status.status ?? 'online';

    const activity = status.activities?.[0];
    if (activity) {
        clearActivity.value = false;
        activityType.value = activity.type;
        activityName.value = activity.name ?? '';
        activityState.value = activity.state ?? '';
        return;
    }

    clearActivity.value = true;
    activityType.value = 0;
    activityName.value = '';
    activityState.value = '';
}

async function loadStatus() {
    loading.value = true;
    try {
        const response = await fetch('/api/discord/status', { credentials: 'include' });
        if (!response.ok) {
            throw new Error('failed_to_load');
        }
        applyStatusToForm(await response.json());
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('bot.presence.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function buildPayload() {
    const payload = {
        status: selectedStatus.value
    };

    if (clearActivity.value) {
        payload.activity = null;
        return payload;
    }

    payload.activity = {
        name: activityName.value.trim(),
        type: activityType.value,
        state: isCustomActivity.value ? activityState.value.trim() : null
    };

    return payload;
}

async function savePresence() {
    if (!isOnline.value) {
        toast.add({
            severity: 'warn',
            summary: t('bot.presence.offline'),
            detail: t('bot.presence.offlineDetail'),
            life: 4000
        });
        return;
    }

    if (!clearActivity.value) {
        if (isCustomActivity.value && !activityState.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: t('toast.validation'),
                detail: t('bot.presence.validationCustom'),
                life: 4000
            });
            return;
        }

        if (!isCustomActivity.value && !activityName.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: t('toast.validation'),
                detail: t('bot.presence.validationName'),
                life: 4000
            });
            return;
        }
    }

    saving.value = true;
    try {
        const response = await fetch('/api/discord/presence', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(buildPayload())
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error ?? 'update_failed');
        }

        applyStatusToForm(data.status);
        toast.add({
            severity: 'success',
            summary: t('bot.presence.saved'),
            detail: t('bot.presence.savedDetail'),
            life: 3000
        });
    } catch (error) {
        const messages = {
            bot_not_connected: t('bot.presence.offlineDetail'),
            invalid_status: t('bot.presence.updateFailed'),
            invalid_activity_type: t('bot.presence.updateFailed'),
            invalid_activity_name: t('bot.presence.updateFailed'),
            update_failed: t('bot.presence.updateFailed')
        };

        toast.add({
            severity: 'error',
            summary: t('toast.saveFailed'),
            detail: messages[error.message] ?? messages.update_failed,
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

onMounted(loadStatus);
</script>

<template>
    <Fluid>
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12 xl:col-span-7">
                <div class="card flex flex-col gap-6">
                    <div>
                        <div class="font-semibold text-xl mb-2">{{ t('bot.presence.title') }}</div>
                        <p class="text-muted-color m-0">{{ t('bot.presence.description') }}</p>
                    </div>

                    <Message v-if="!loading && !isOnline" severity="warn" :closable="false">
                        {{ t('bot.presence.offlineWarning') }}
                    </Message>

                    <div class="flex flex-col gap-2">
                        <label for="presence-status">{{ t('bot.presence.onlineStatus') }}</label>
                        <Select
                            id="presence-status"
                            v-model="selectedStatus"
                            :options="presenceStatusOptions"
                            optionLabel="label"
                            optionValue="value"
                            :placeholder="t('bot.presence.selectStatus')"
                            class="w-full"
                            :disabled="loading || saving"
                        >
                            <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex items-center gap-2">
                                    <span
                                        class="status-dot"
                                        :class="presenceStatusOptions.find((option) => option.value === slotProps.value)?.dotClass"
                                    ></span>
                                    <span>{{ formatPresenceStatus(slotProps.value) }}</span>
                                </div>
                                <span v-else>{{ slotProps.placeholder }}</span>
                            </template>
                            <template #option="slotProps">
                                <div class="flex items-center gap-2">
                                    <span class="status-dot" :class="slotProps.option.dotClass"></span>
                                    <span>{{ slotProps.option.label }}</span>
                                </div>
                            </template>
                        </Select>
                    </div>

                    <Divider />

                    <div class="font-semibold text-lg">{{ t('bot.presence.activity') }}</div>

                    <div class="flex items-center gap-3">
                        <Checkbox v-model="clearActivity" inputId="clear-activity" binary :disabled="loading || saving" />
                        <label for="clear-activity">{{ t('bot.presence.clearActivity') }}</label>
                    </div>

                    <div v-if="!clearActivity" class="flex flex-col gap-4">
                        <div class="flex flex-col gap-2">
                            <label for="activity-type">{{ t('bot.presence.activityType') }}</label>
                            <Select
                                id="activity-type"
                                v-model="activityType"
                                :options="activityTypeOptions"
                                optionLabel="label"
                                optionValue="value"
                                :placeholder="t('bot.presence.selectActivityType')"
                                class="w-full"
                                :disabled="loading || saving"
                            />
                        </div>

                        <div v-if="!isCustomActivity" class="flex flex-col gap-2">
                            <label for="activity-name">{{ t('bot.presence.activityName') }}</label>
                            <InputText
                                id="activity-name"
                                v-model="activityName"
                                placeholder="e.g. Minecraft"
                                class="w-full"
                                :disabled="loading || saving"
                            />
                        </div>

                        <div v-else class="flex flex-col gap-2">
                            <label for="activity-state">{{ t('bot.presence.customStatus') }}</label>
                            <InputText
                                id="activity-state"
                                v-model="activityState"
                                placeholder="e.g. Managing the server"
                                class="w-full"
                                :disabled="loading || saving"
                            />
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-3 pt-2">
                        <Button label="Save Changes" icon="pi pi-check" :loading="saving" :disabled="loading" @click="savePresence" />
                        <Button label="Reset" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || saving" @click="loadStatus" />
                    </div>
                </div>
            </div>

            <div class="col-span-12 xl:col-span-5">
                <div class="card flex flex-col gap-4 h-full">
                    <div class="font-semibold text-xl">{{ t('bot.presence.preview') }}</div>

                    <div class="preview-card rounded-border p-4">
                        <div class="flex items-center gap-4">
                            <div class="preview-avatar-wrap rounded-border overflow-hidden shrink-0">
                                <img v-if="clientStatus?.avatarURL" :src="clientStatus.avatarURL" :alt="clientStatus.username ?? 'Bot'" class="preview-avatar" />
                                <div v-else class="preview-avatar preview-avatar--placeholder">
                                    <i class="pi pi-discord text-2xl"></i>
                                </div>
                            </div>

                            <div class="min-w-0">
                                <div class="font-semibold text-lg truncate">{{ clientStatus?.username ?? t('bot.presence.discordBot') }}</div>
                                <div class="flex items-center gap-2 text-muted-color mt-1">
                                    <span class="status-dot shrink-0" :class="selectedStatusOption.dotClass"></span>
                                    <span>{{ previewStatusLabel }}</span>
                                </div>
                                <div class="text-sm text-muted-color mt-2 truncate">{{ previewActivityText }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="text-sm text-muted-color">
                        {{ t('bot.presence.previewHint') }}
                    </div>
                </div>
            </div>
        </div>
    </Fluid>
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

.status-dot--idle {
    background-color: #eab308;
}

.status-dot--dnd {
    background-color: #ef4444;
}

.status-dot--offline {
    background-color: #94a3b8;
}

.preview-card {
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
}

.preview-avatar-wrap {
    width: 4rem;
    height: 4rem;
}

.preview-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preview-avatar--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-100);
    color: var(--primary-color);
}
</style>
