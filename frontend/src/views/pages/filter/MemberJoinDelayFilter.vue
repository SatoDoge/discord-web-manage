<script setup>
import MemberFilterCommonSettings from '@/components/filter/MemberFilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { createMemberJoinDelayFilterSettings } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { notificationChannelOptions, roleOptions, loading: loadingOptions, loadDiscordOptions } =
    useDiscordOptions();

const loading = ref(true);
const saving = ref(false);
const form = reactive(createMemberJoinDelayFilterSettings());

function applySettings(settings) {
    Object.assign(form, createMemberJoinDelayFilterSettings(), settings);
}

async function loadSettings() {
    loading.value = true;
    try {
        applySettings(await apiFetch('/api/filter/member/join-delay'));
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.loadFailed'),
            detail: t('filter.memberJoinDelay.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function saveSettings() {
    saving.value = true;
    try {
        applySettings(await apiFetch('/api/filter/member/join-delay', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form })
        }));
        toast.add({
            severity: 'success',
            summary: t('filter.toast.saved'),
            detail: t('filter.memberJoinDelay.saveSuccess'),
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.saveFailed'),
            detail: t('filter.memberJoinDelay.saveFailed'),
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
                        <div class="font-semibold text-xl mb-2">{{ t('filter.memberJoinDelay.title') }}</div>
                        <p class="text-muted-color m-0">
                            {{ t('filter.memberJoinDelay.description') }}
                        </p>
                    </div>

                    <MemberFilterCommonSettings
                        :form="form"
                        :notification-channel-options="notificationChannelOptions"
                        :role-options="roleOptions"
                        :disabled="loading || saving || loadingOptions"
                    />

                    <Divider />

                    <div>
                        <div class="font-semibold text-lg mb-1">{{ t('filter.memberJoinDelay.threshold') }}</div>
                        <p class="text-muted-color m-0 text-sm">{{ t('filter.memberJoinDelay.thresholdHint') }}</p>
                    </div>

                    <div class="flex flex-col gap-2 max-w-md">
                        <label for="join-delay-seconds">{{ t('filter.memberJoinDelay.requiredSeconds') }}</label>
                        <InputNumber
                            id="join-delay-seconds"
                            v-model="form.joinDelaySeconds"
                            class="w-full"
                            :disabled="loading || saving"
                            :min="1"
                            showButtons
                            :placeholder="t('filter.common.disabled')"
                        />
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
