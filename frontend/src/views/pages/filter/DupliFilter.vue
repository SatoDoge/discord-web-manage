<script setup>
import FilterCommonSettings from '@/components/filter/FilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { createDupliFilterSettings } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

const toast = useToast();
const { channelOptions, notificationChannelOptions, roleOptions, loading: loadingOptions, loadDiscordOptions } =
    useDiscordOptions();

const loading = ref(true);
const saving = ref(false);
const form = reactive(createDupliFilterSettings());

function applySettings(settings) {
    Object.assign(form, createDupliFilterSettings(), settings);
}

async function loadSettings() {
    loading.value = true;
    try {
        applySettings(await apiFetch('/api/filter/dupli'));
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Load failed',
            detail: 'Could not fetch duplicate filter settings.',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function saveSettings() {
    saving.value = true;
    try {
        applySettings(await apiFetch('/api/filter/dupli', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form })
        }));
        toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Duplicate filter settings were updated.',
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Save failed',
            detail: 'Could not update duplicate filter settings.',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    await Promise.all([loadDiscordOptions(), loadSettings()]);
});
</script>

<template>
    <Fluid>
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12 xl:col-span-8">
                <div class="card flex flex-col gap-6">
                    <div>
                        <div class="font-semibold text-xl mb-2">Duplicate Filter</div>
                        <p class="text-muted-color m-0">
                            Detect rapid or repeated messages from the same user within short time windows.
                        </p>
                    </div>

                    <FilterCommonSettings
                        :form="form"
                        :channel-options="channelOptions"
                        :notification-channel-options="notificationChannelOptions"
                        :role-options="roleOptions"
                        :disabled="loading || saving || loadingOptions"
                    />

                    <Divider />

                    <div>
                        <div class="font-semibold text-lg mb-1">Thresholds</div>
                        <p class="text-muted-color m-0 text-sm">Leave a field empty to disable that window.</p>
                    </div>

                    <div class="grid grid-cols-12 gap-4">
                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="dupli-per-second">Per 1 second</label>
                            <InputNumber
                                id="dupli-per-second"
                                v-model="form.duplicateMessagePerSeconds"
                                class="w-full"
                                :disabled="loading || saving"
                                :min="1"
                                showButtons
                                placeholder="Disabled"
                            />
                        </div>
                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="dupli-per-10-seconds">Per 10 seconds</label>
                            <InputNumber
                                id="dupli-per-10-seconds"
                                v-model="form.duplicateMessagePer10Seconds"
                                class="w-full"
                                :disabled="loading || saving"
                                :min="1"
                                showButtons
                                placeholder="Disabled"
                            />
                        </div>
                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="dupli-per-minute">Per 1 minute</label>
                            <InputNumber
                                id="dupli-per-minute"
                                v-model="form.duplicateMessagePerMinutes"
                                class="w-full"
                                :disabled="loading || saving"
                                :min="1"
                                showButtons
                                placeholder="Disabled"
                            />
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isOnlySameContentMessage"
                            inputId="dupli-same-content"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="dupli-same-content">Count only messages with identical content</label>
                    </div>

                    <div class="flex flex-wrap gap-3 pt-2">
                        <Button label="Save Changes" icon="pi pi-check" :loading="saving" :disabled="loading || loadingOptions" @click="saveSettings" />
                        <Button label="Reset" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || saving" @click="loadSettings" />
                    </div>
                </div>
            </div>
        </div>
    </Fluid>
</template>
