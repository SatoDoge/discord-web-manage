<script setup>
import FilterCommonSettings from '@/components/filter/FilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { useFilterOptions } from '@/composables/useFilterOptions';
import { apiFetch } from '@/utils/api';
import { createModerationFilterSettings } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { moderationCategoryOptions } = useFilterOptions();
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
            summary: t('filter.toast.loadFailed'),
            detail: t('filter.moderation.loadFailed'),
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
            summary: t('filter.toast.saved'),
            detail: t('filter.moderation.saveSuccess'),
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.saveFailed'),
            detail: t('filter.moderation.saveFailed'),
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
                        <div class="font-semibold text-xl mb-2">{{ t('filter.moderation.title') }}</div>
                        <p class="text-muted-color m-0">
                            {{ t('filter.moderation.description') }}
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
                        <div class="font-semibold text-lg mb-1">{{ t('filter.moderation.detectionScope') }}</div>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isFilterAppliedToContent"
                            inputId="moderation-content"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-content">{{ t('filter.moderation.checkContent') }}</label>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isFilterAppliedToImage"
                            inputId="moderation-image"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-image">{{ t('filter.moderation.checkImage') }}</label>
                    </div>

                    <Divider />

                    <div>
                        <div class="font-semibold text-lg mb-1">{{ t('filter.moderation.customThresholds') }}</div>
                        <p class="text-muted-color m-0 text-sm">
                            {{ t('filter.moderation.customThresholdsHint') }}
                        </p>
                    </div>

                    <div class="flex items-center gap-3">
                        <Checkbox
                            v-model="form.isUseCustomFlag"
                            inputId="moderation-custom-flag"
                            binary
                            :disabled="loading || saving"
                        />
                        <label for="moderation-custom-flag">{{ t('filter.moderation.useCustomFlag') }}</label>
                    </div>

                    <div v-if="form.isUseCustomFlag" class="grid grid-cols-12 gap-4">
                        <div
                            v-for="category in moderationCategoryOptions"
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
                                :placeholder="t('filter.common.disabled')"
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
