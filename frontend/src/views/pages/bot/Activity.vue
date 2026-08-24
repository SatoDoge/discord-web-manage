<script setup>
import {
    ACTIVITY_TYPE_OPTIONS,
    PRESENCE_STATUS_OPTIONS,
    formatDiscordActivity,
    formatPresenceStatus
} from '@/utils/discordPresence';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();

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
        return 'No activity set';
    }

    return formatDiscordActivity({
        name: activityName.value.trim(),
        type: activityType.value,
        state: activityState.value.trim() || null
    });
});

const previewStatusLabel = computed(() => formatPresenceStatus(selectedStatus.value));

const selectedStatusOption = computed(
    () => PRESENCE_STATUS_OPTIONS.find((option) => option.value === selectedStatus.value) ?? PRESENCE_STATUS_OPTIONS[0]
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
            summary: 'Load failed',
            detail: 'Could not fetch the current bot status.',
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
            summary: 'Bot offline',
            detail: 'The Discord bot must be connected before updating presence.',
            life: 4000
        });
        return;
    }

    if (!clearActivity.value) {
        if (isCustomActivity.value && !activityState.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: 'Validation',
                detail: 'Custom status text is required.',
                life: 4000
            });
            return;
        }

        if (!isCustomActivity.value && !activityName.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: 'Validation',
                detail: 'Activity name is required.',
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
            summary: 'Presence updated',
            detail: 'Bot status and activity were saved.',
            life: 3000
        });
    } catch (error) {
        const messages = {
            bot_not_connected: 'The Discord bot is not connected.',
            invalid_status: 'The selected status is invalid.',
            invalid_activity_type: 'The selected activity type is invalid.',
            invalid_activity_name: 'Activity details are incomplete.',
            update_failed: 'Could not update bot presence.'
        };

        toast.add({
            severity: 'error',
            summary: 'Update failed',
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
                        <div class="font-semibold text-xl mb-2">Bot Presence</div>
                        <p class="text-muted-color m-0">Update the Discord bot's online status and activity shown to server members.</p>
                    </div>

                    <Message v-if="!loading && !isOnline" severity="warn" :closable="false">
                        The Discord bot is currently offline. Settings can be prepared, but changes will not apply until the bot connects.
                    </Message>

                    <div class="flex flex-col gap-2">
                        <label for="presence-status">Online Status</label>
                        <Select
                            id="presence-status"
                            v-model="selectedStatus"
                            :options="PRESENCE_STATUS_OPTIONS"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Select status"
                            class="w-full"
                            :disabled="loading || saving"
                        >
                            <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex items-center gap-2">
                                    <span
                                        class="status-dot"
                                        :class="PRESENCE_STATUS_OPTIONS.find((option) => option.value === slotProps.value)?.dotClass"
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

                    <div class="font-semibold text-lg">Activity</div>

                    <div class="flex items-center gap-3">
                        <Checkbox v-model="clearActivity" inputId="clear-activity" binary :disabled="loading || saving" />
                        <label for="clear-activity">Clear activity</label>
                    </div>

                    <div v-if="!clearActivity" class="flex flex-col gap-4">
                        <div class="flex flex-col gap-2">
                            <label for="activity-type">Activity Type</label>
                            <Select
                                id="activity-type"
                                v-model="activityType"
                                :options="ACTIVITY_TYPE_OPTIONS"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Select activity type"
                                class="w-full"
                                :disabled="loading || saving"
                            />
                        </div>

                        <div v-if="!isCustomActivity" class="flex flex-col gap-2">
                            <label for="activity-name">Activity Name</label>
                            <InputText
                                id="activity-name"
                                v-model="activityName"
                                placeholder="e.g. Minecraft"
                                class="w-full"
                                :disabled="loading || saving"
                            />
                        </div>

                        <div v-else class="flex flex-col gap-2">
                            <label for="activity-state">Custom Status Text</label>
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
                    <div class="font-semibold text-xl">Preview</div>

                    <div class="preview-card rounded-border p-4">
                        <div class="flex items-center gap-4">
                            <div class="preview-avatar-wrap rounded-border overflow-hidden shrink-0">
                                <img v-if="clientStatus?.avatarURL" :src="clientStatus.avatarURL" :alt="clientStatus.username ?? 'Bot'" class="preview-avatar" />
                                <div v-else class="preview-avatar preview-avatar--placeholder">
                                    <i class="pi pi-discord text-2xl"></i>
                                </div>
                            </div>

                            <div class="min-w-0">
                                <div class="font-semibold text-lg truncate">{{ clientStatus?.username ?? 'Discord Bot' }}</div>
                                <div class="flex items-center gap-2 text-muted-color mt-1">
                                    <span class="status-dot shrink-0" :class="selectedStatusOption.dotClass"></span>
                                    <span>{{ previewStatusLabel }}</span>
                                </div>
                                <div class="text-sm text-muted-color mt-2 truncate">{{ previewActivityText }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="text-sm text-muted-color">
                        This preview reflects the values in the form. Save to apply them to the connected Discord bot.
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
