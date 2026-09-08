<script setup>
import { apiFetch } from '@/utils/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();

const channels = ref([]);
const loading = ref(true);
const acting = ref(false);
const selectionKeys = ref({});
const expandedKeys = ref({});

const moveDialog = reactive({
    visible: false,
    channelId: null,
    reason: ''
});

const reasonDialog = reactive({
    visible: false,
    action: null,
    reason: ''
});

let refreshTimer = null;

const treeNodes = computed(() =>
    channels.value.map((channel) => {
        const limitLabel =
            channel.userLimit > 0
                ? `${channel.memberCount}/${channel.userLimit}`
                : `${channel.memberCount}`;

        return {
            key: `channel:${channel.id}`,
            data: {
                kind: 'channel',
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentName: channel.parentName,
                userLimit: channel.userLimit,
                memberCount: channel.memberCount,
                occupancyLabel: limitLabel
            },
            children: channel.members.map((member) => ({
                key: `member:${member.id}`,
                leaf: true,
                data: {
                    kind: 'member',
                    id: member.id,
                    name: member.displayName,
                    username: member.username,
                    avatarURL: member.avatarURL,
                    channelId: member.channelId,
                    selfMute: member.selfMute,
                    selfDeaf: member.selfDeaf,
                    serverMute: member.serverMute,
                    serverDeaf: member.serverDeaf,
                    streaming: member.streaming,
                    selfVideo: member.selfVideo,
                    suppress: member.suppress
                }
            }))
        };
    })
);

const voiceChannelOptions = computed(() =>
    channels.value.map((channel) => ({
        label:
            channel.userLimit > 0
                ? `${channel.name} (${channel.memberCount}/${channel.userLimit})`
                : `${channel.name} (${channel.memberCount})`,
        value: channel.id
    }))
);

const selectedMemberIds = computed(() => {
    const keys = selectionKeys.value || {};
    const ids = new Set();

    for (const [key, state] of Object.entries(keys)) {
        if (!state?.checked) {
            continue;
        }
        if (key.startsWith('member:')) {
            ids.add(key.slice('member:'.length));
        } else if (key.startsWith('channel:')) {
            const channelId = key.slice('channel:'.length);
            const channel = channels.value.find((entry) => entry.id === channelId);
            for (const member of channel?.members ?? []) {
                ids.add(member.id);
            }
        }
    }

    return [...ids];
});

const selectedCount = computed(() => selectedMemberIds.value.length);

function errorDetail(error) {
    const code = error?.message;
    if (!code) {
        return t('manage.voice.actionFailed');
    }
    const key = `manage.voice.errors.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
}

function statusTags(member) {
    const tags = [];
    if (member.serverMute) {
        tags.push({ label: t('manage.voice.statusServerMute'), severity: 'danger', icon: 'pi pi-microphone' });
    } else if (member.selfMute) {
        tags.push({ label: t('manage.voice.statusSelfMute'), severity: 'warn', icon: 'pi pi-microphone' });
    }
    if (member.serverDeaf) {
        tags.push({ label: t('manage.voice.statusServerDeaf'), severity: 'danger', icon: 'pi pi-volume-off' });
    } else if (member.selfDeaf) {
        tags.push({ label: t('manage.voice.statusSelfDeaf'), severity: 'warn', icon: 'pi pi-volume-off' });
    }
    if (member.streaming) {
        tags.push({ label: t('manage.voice.statusStreaming'), severity: 'info', icon: 'pi pi-desktop' });
    }
    if (member.selfVideo) {
        tags.push({ label: t('manage.voice.statusVideo'), severity: 'info', icon: 'pi pi-video' });
    }
    if (member.suppress) {
        tags.push({ label: t('manage.voice.statusSuppress'), severity: 'secondary', icon: 'pi pi-ban' });
    }
    return tags;
}

function expandOccupiedChannels(list) {
    const next = {};
    for (const channel of list) {
        if (channel.memberCount > 0) {
            next[`channel:${channel.id}`] = true;
        }
    }
    expandedKeys.value = next;
}

async function loadVoiceChannels({ preserveSelection = false } = {}) {
    loading.value = true;
    try {
        const data = await apiFetch('/api/discord/voice/channels');
        channels.value = data;
        expandOccupiedChannels(data);
        if (!preserveSelection) {
            selectionKeys.value = {};
        }
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.voice.loadFailed'),
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function requireSelection() {
    if (selectedMemberIds.value.length === 0) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.voice.selectMembers'),
            life: 3000
        });
        return false;
    }
    return true;
}

function openReasonDialog(action) {
    if (!requireSelection()) {
        return;
    }
    reasonDialog.visible = true;
    reasonDialog.action = action;
    reasonDialog.reason = '';
}

function openMoveDialog() {
    if (!requireSelection()) {
        return;
    }
    moveDialog.visible = true;
    moveDialog.channelId = null;
    moveDialog.reason = '';
}

async function runAction(action, { channelId, reason } = {}) {
    if (acting.value) {
        return;
    }
    acting.value = true;
    try {
        const body = {
            userIds: selectedMemberIds.value,
            action,
            reason: reason?.trim() || undefined
        };
        if (action === 'move') {
            body.channelId = channelId;
        }

        const result = await apiFetch('/api/discord/voice/members/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (result.failed > 0) {
            toast.add({
                severity: 'warn',
                summary: t('manage.voice.partialSuccess'),
                detail: t('manage.voice.partialSuccessDetail', {
                    succeeded: result.succeeded,
                    failed: result.failed
                }),
                life: 5000
            });
        } else {
            toast.add({
                severity: 'success',
                summary: t('toast.saved'),
                detail: t(`manage.voice.success.${action}`, { count: result.succeeded }),
                life: 3000
            });
        }

        selectionKeys.value = {};
        await loadVoiceChannels({ preserveSelection: false });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('manage.voice.actionFailed'),
            detail: errorDetail(error),
            life: 4000
        });
    } finally {
        acting.value = false;
    }
}

async function confirmReasonAction() {
    const action = reasonDialog.action;
    reasonDialog.visible = false;
    await runAction(action, { reason: reasonDialog.reason });
}

async function confirmMove() {
    if (!moveDialog.channelId) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: t('manage.voice.selectTargetChannel'),
            life: 3000
        });
        return;
    }
    moveDialog.visible = false;
    await runAction('move', {
        channelId: moveDialog.channelId,
        reason: moveDialog.reason
    });
}

onMounted(() => {
    void loadVoiceChannels();
    refreshTimer = window.setInterval(() => {
        void loadVoiceChannels({ preserveSelection: true });
    }, 15000);
});

onUnmounted(() => {
    if (refreshTimer) {
        window.clearInterval(refreshTimer);
    }
});
</script>

<template>
    <div class="card">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
                <div class="font-semibold text-xl mb-1">{{ t('manage.voice.title') }}</div>
                <p class="text-muted-color m-0">{{ t('manage.voice.description') }}</p>
            </div>
            <Button
                :label="t('manage.voice.refresh')"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                :loading="loading"
                @click="loadVoiceChannels()"
            />
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
            <Button
                :label="t('manage.voice.disconnect')"
                icon="pi pi-sign-out"
                severity="danger"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openReasonDialog('disconnect')"
            />
            <Button
                :label="t('manage.voice.serverMute')"
                icon="pi pi-microphone"
                severity="warn"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openReasonDialog('mute')"
            />
            <Button
                :label="t('manage.voice.serverUnmute')"
                icon="pi pi-microphone"
                severity="secondary"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openReasonDialog('unmute')"
            />
            <Button
                :label="t('manage.voice.serverDeaf')"
                icon="pi pi-volume-off"
                severity="warn"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openReasonDialog('deaf')"
            />
            <Button
                :label="t('manage.voice.serverUndeaf')"
                icon="pi pi-volume-up"
                severity="secondary"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openReasonDialog('undeaf')"
            />
            <Button
                :label="t('manage.voice.move')"
                icon="pi pi-arrows-h"
                outlined
                :disabled="selectedCount === 0 || acting"
                @click="openMoveDialog"
            />
            <span class="text-muted-color self-center text-sm ml-1">
                {{ t('manage.voice.selectedCount', { count: selectedCount }) }}
            </span>
        </div>

        <div v-if="loading && treeNodes.length === 0" class="flex justify-center py-10">
            <ProgressSpinner style="width: 3rem; height: 3rem" />
        </div>

        <TreeTable
            v-else
            v-model:selectionKeys="selectionKeys"
            v-model:expandedKeys="expandedKeys"
            :value="treeNodes"
            selectionMode="checkbox"
            :loading="loading"
            class="voice-tree-table"
            tableStyle="min-width: 48rem"
        >
            <Column field="name" :header="t('manage.voice.name')" expander style="width: 40%">
                <template #body="{ node }">
                    <div v-if="node.data.kind === 'channel'" class="flex items-center gap-2 py-1">
                        <i
                            :class="node.data.type === 13 ? 'pi pi-microphone' : 'pi pi-volume-up'"
                            class="text-muted-color"
                        />
                        <div class="flex flex-col">
                            <span class="font-semibold">{{ node.data.name }}</span>
                            <span v-if="node.data.parentName" class="text-muted-color text-sm">
                                {{ node.data.parentName }}
                            </span>
                        </div>
                        <Tag
                            :value="node.data.occupancyLabel"
                            :severity="node.data.memberCount > 0 ? 'info' : 'secondary'"
                            class="ml-2"
                        />
                    </div>
                    <div v-else class="flex items-center gap-2 py-1">
                        <img
                            :src="node.data.avatarURL"
                            :alt="node.data.name"
                            class="member-avatar"
                        />
                        <div class="flex flex-col">
                            <span class="font-medium">{{ node.data.name }}</span>
                            <span class="text-muted-color text-sm">@{{ node.data.username }}</span>
                        </div>
                    </div>
                </template>
            </Column>

            <Column :header="t('manage.voice.status')" style="width: 45%">
                <template #body="{ node }">
                    <div v-if="node.data.kind === 'member'" class="flex flex-wrap gap-2">
                        <Tag
                            v-for="tag in statusTags(node.data)"
                            :key="tag.label"
                            :value="tag.label"
                            :severity="tag.severity"
                            :icon="tag.icon"
                        />
                        <span v-if="statusTags(node.data).length === 0" class="text-muted-color text-sm">
                            {{ t('manage.voice.statusNormal') }}
                        </span>
                    </div>
                    <span v-else class="text-muted-color text-sm">
                        {{
                            t('manage.voice.channelMemberSummary', {
                                count: node.data.memberCount,
                                limit:
                                    node.data.userLimit > 0
                                        ? String(node.data.userLimit)
                                        : t('manage.voice.unlimited')
                            })
                        }}
                    </span>
                </template>
            </Column>
        </TreeTable>

        <div v-if="!loading && treeNodes.length === 0" class="text-center text-muted-color py-8">
            {{ t('manage.voice.empty') }}
        </div>
    </div>

    <Dialog
        v-model:visible="reasonDialog.visible"
        modal
        :header="t(`manage.voice.confirm.${reasonDialog.action}`)"
        class="w-full max-w-md"
    >
        <p class="m-0 mb-4">
            {{ t('manage.voice.confirmDetail', { count: selectedCount }) }}
        </p>
        <div class="flex flex-col gap-2">
            <label for="voice-action-reason">{{ t('manage.voice.reasonPlaceholder') }}</label>
            <InputText id="voice-action-reason" v-model="reasonDialog.reason" />
        </div>
        <template #footer>
            <Button
                :label="t('manage.voice.cancel')"
                severity="secondary"
                text
                :disabled="acting"
                @click="reasonDialog.visible = false"
            />
            <Button
                :label="t('manage.voice.execute')"
                icon="pi pi-check"
                :loading="acting"
                @click="confirmReasonAction"
            />
        </template>
    </Dialog>

    <Dialog
        v-model:visible="moveDialog.visible"
        modal
        :header="t('manage.voice.moveDialogTitle')"
        class="w-full max-w-md"
    >
        <p class="m-0 mb-4">
            {{ t('manage.voice.confirmDetail', { count: selectedCount }) }}
        </p>
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="voice-move-target">{{ t('manage.voice.targetChannel') }}</label>
                <Select
                    id="voice-move-target"
                    v-model="moveDialog.channelId"
                    :options="voiceChannelOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :placeholder="t('manage.voice.selectTargetChannel')"
                />
            </div>
            <div class="flex flex-col gap-2">
                <label for="voice-move-reason">{{ t('manage.voice.reasonPlaceholder') }}</label>
                <InputText id="voice-move-reason" v-model="moveDialog.reason" />
            </div>
        </div>
        <template #footer>
            <Button
                :label="t('manage.voice.cancel')"
                severity="secondary"
                text
                :disabled="acting"
                @click="moveDialog.visible = false"
            />
            <Button
                :label="t('manage.voice.move')"
                icon="pi pi-arrows-h"
                :loading="acting"
                @click="confirmMove"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.member-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    object-fit: cover;
    flex-shrink: 0;
}

.voice-tree-table :deep(.p-treetable-tbody > tr) {
    vertical-align: middle;
}
</style>
