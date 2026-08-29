<script setup>
import FilterCommonSettings from '@/components/filter/FilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { createModerationFilterSettings, MODERATION_CATEGORIES } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

const toast = useToast();
const { channelOptions, notificationChannelOptions, roleOptions, loading: loadingOptions, loadDiscordOptions } =
    useDiscordOptions();

const loading = ref(true);
const saving = ref(false);
const form = reactive(createModerationFilterSettings());

function applySettings(settings) {
    Object.assign(form, createModerationFilterSettings(), settings);
}

async function loadSettings() {
    loading.value = true;
    try {
        applySettings(await apiFetch('/api/filter/moderation'));
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Load failed',
            detail: 'Could not fetch moderation filter settings.',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function saveSettings() {
    saving.value = true;
    try {
        applySettings(await apiFetch('/api/filter/moderation', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form })
        }));
        toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Moderation filter settings were updated.',
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Save failed',
            detail: 'Could not update moderation filter settings.',
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
                        <div class="font-semibold text-xl mb-2">Moderation Filter</div>
                        <p class="text-muted-color m-0">
                            Use OpenAI moderation to flag harmful text and images. Custom thresholds override the default flagged result.
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
                        <div class="font-semibold text-lg mb-1">Detection scope</div>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isFilterAppliedToContent"
                            inputId="moderation-content"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-content">Check message text, embeds, and attachment metadata</label>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isFilterAppliedToImage"
                            inputId="moderation-image"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-image">Check image attachments and embed images</label>
                    </div>

                    <Divider />

                    <div>
                        <div class="font-semibold text-lg mb-1">Custom thresholds</div>
                        <p class="text-muted-color m-0 text-sm">
                            Enable custom thresholds to flag content when a category score reaches the configured value between 0 and 1.
                        </p>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isUseCustomFlag"
                            inputId="moderation-custom-flag"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-custom-flag">Use custom category thresholds</label>
                    </div>

                    <div v-if="form.isUseCustomFlag" class="grid grid-cols-12 gap-4">
                        <div
                            v-for="category in MODERATION_CATEGORIES"
                            :key="category.key"
                            class="col-span-12 md:col-span-6 flex flex-col gap-2"
                        >
                            <label :for="`moderation-${category.key}`">{{ category.label }}</label>
                            <InputNumber
                                :id="`moderation-${category.key}`"
                                v-model="form[category.key]"
                                class="w-full"
                                :disabled="loading || saving"
                                :min="0"
                                :max="1"
                                :step="0.01"
                                mode="decimal"
                                :minFractionDigits="2"
                                :maxFractionDigits="2"
                                showButtons
                                placeholder="Disabled"
                            />
                        </div>
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
