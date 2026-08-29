<script setup>
import FilterCommonSettings from '@/components/filter/FilterCommonSettings.vue';
import { useDiscordOptions } from '@/composables/useDiscordOptions';
import { apiFetch } from '@/utils/api';
import { createWordFilterSettings, linesToList, listToLines } from '@/utils/filterDefaults';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

const toast = useToast();
const { channelOptions, notificationChannelOptions, roleOptions, loading: loadingOptions, loadDiscordOptions } =
    useDiscordOptions();

const loading = ref(true);
const saving = ref(false);
const form = reactive(createWordFilterSettings());
const wordListText = ref('');
const urlListText = ref('');

function applySettings(settings) {
    Object.assign(form, createWordFilterSettings(), settings);
    wordListText.value = listToLines(form.wordFilterList);
    urlListText.value = listToLines(form.urlFilterList);
}

function buildPayload() {
    return {
        ...form,
        wordFilterList: linesToList(wordListText.value),
        urlFilterList: linesToList(urlListText.value)
    };
}

async function loadSettings() {
    loading.value = true;
    try {
        applySettings(await apiFetch('/api/filter/word'));
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Load failed',
            detail: 'Could not fetch word filter settings.',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function saveSettings() {
    saving.value = true;
    try {
        applySettings(await apiFetch('/api/filter/word', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload())
        }));
        toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Word filter settings were updated.',
            life: 3000
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Save failed',
            detail: 'Could not update word filter settings.',
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
                        <div class="font-semibold text-xl mb-2">Word Filter</div>
                        <p class="text-muted-color m-0">
                            Block messages that contain specific words or URLs in text, embeds, and attachments.
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
                        <div class="font-semibold text-lg mb-1">Blocked words</div>
                        <p class="text-muted-color m-0 text-sm">One word or phrase per line.</p>
                    </div>

                    <Textarea
                        v-model="wordListText"
                        rows="8"
                        class="w-full font-mono text-sm"
                        :disabled="loading || saving"
                        placeholder="spam&#10;badword"
                    />

                    <div>
                        <div class="font-semibold text-lg mb-1">Blocked URL patterns</div>
                        <p class="text-muted-color m-0 text-sm">One pattern per line. Use * as a suffix wildcard.</p>
                    </div>

                    <Textarea
                        v-model="urlListText"
                        rows="6"
                        class="w-full font-mono text-sm"
                        :disabled="loading || saving"
                        placeholder="https://example.com/*&#10;discord.gg/*"
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
