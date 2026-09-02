<script setup>
import MemberFilterCommonSettings from '@/components/filter/MemberFilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { createMemberNameFilterSettings, linesToList, listToLines } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const { notificationChannelOptions, roleOptions, loading: loadingOptions, loadDiscordOptions } =
    useDiscordOptions();

const loading = ref(true);
const saving = ref(false);
const form = reactive(createMemberNameFilterSettings());
const nameListText = ref('');

function applySettings(settings) {
    Object.assign(form, createMemberNameFilterSettings(), settings);
    nameListText.value = listToLines(form.nameFilterList);
}

function buildPayload() {
    return {
        ...form,
        nameFilterList: linesToList(nameListText.value)
    };
}

async function loadSettings() {
    loading.value = true;
    try {
        applySettings(await apiFetch('/api/filter/member/name'));
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.loadFailed'),
            detail: t('filter.memberName.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function saveSettings() {
    saving.value = true;
    try {
        applySettings(await apiFetch('/api/filter/member/name', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload())
        }));
        toast.add({
            severity: 'success',
            summary: t('filter.toast.saved'),
            detail: t('filter.memberName.saveSuccess'),
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: t('filter.toast.saveFailed'),
            detail: t('filter.memberName.saveFailed'),
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
                        <div class="font-semibold text-xl mb-2">{{ t('filter.memberName.title') }}</div>
                        <p class="text-muted-color m-0">
                            {{ t('filter.memberName.description') }}
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
                        <div class="font-semibold text-lg mb-1">{{ t('filter.memberName.blockedNames') }}</div>
                        <p class="text-muted-color m-0 text-sm">{{ t('filter.memberName.blockedNamesHint') }}</p>
                    </div>

                    <Textarea
                        v-model="nameListText"
                        rows="8"
                        class="w-full font-mono text-sm"
                        :disabled="loading || saving"
                        placeholder="spam&#10;admin"
                    />

                    <div class="flex flex-wrap gap-3 pt-2">
                        <Button label="Save Changes" icon="pi pi-check" :loading="saving" :disabled="loading || loadingOptions" @click="saveSettings" />
                        <Button label="Reset" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || saving" @click="loadSettings" />
                    </div>
                </div>
            </div>
        </div>
    </Fluid>
</template>
