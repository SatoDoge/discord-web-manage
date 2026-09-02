<script setup>
import DiscordEmbedPreview from '@/components/manage/DiscordEmbedPreview.vue';
import { useMessageAttachments } from '@/composables/useMessageAttachments';
import { DEFAULT_EMBED_TEMPLATE, parseEmbedJsonInput } from '@/utils/discordEmbed';
import { parseDiscordMessageTarget } from '@/utils/discordMessageTarget';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const toast = useToast();
const {
    attachments,
    attachmentCount,
    hasAttachments,
    maxAttachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    handlePaste,
    formatFileSize
} = useMessageAttachments();

const fileInputRef = ref(null);

const CHANNEL_TYPE = {
    GuildText: 0,
    GuildAnnouncement: 5,
    AnnouncementThread: 10,
    PublicThread: 11,
    PrivateThread: 12,
    GuildForum: 15
};

const loadingChannels = ref(true);
const sending = ref(false);
const channels = ref([]);

const destinationForm = reactive({
    mode: 'send',
    channelId: null,
    threadName: '',
    replyTarget: '',
    reason: ''
});

const messageForm = reactive({
    format: 'text',
    content: '',
    embedJson: DEFAULT_EMBED_TEMPLATE
});

const sendModeOptions = computed(() => [
    { label: t('manage.send.modeSend'), value: 'send' },
    { label: t('manage.send.modeReply'), value: 'reply' }
]);

const messageFormatOptions = computed(() => [
    { label: t('manage.send.formatText'), value: 'text' },
    { label: t('manage.send.formatEmbed'), value: 'embed' }
]);

const channelById = computed(() => {
    const map = new Map();
    for (const channel of channels.value) {
        map.set(channel.id, channel);
    }
    return map;
});

const selectedChannel = computed(() =>
    destinationForm.channelId ? channelById.value.get(destinationForm.channelId) ?? null : null
);

const isForumChannel = computed(() => selectedChannel.value?.type === CHANNEL_TYPE.GuildForum);
const isReplyMode = computed(() => destinationForm.mode === 'reply');
const showThreadName = computed(() => !isReplyMode.value && isForumChannel.value);

const parsedReplyTarget = computed(() => parseDiscordMessageTarget(destinationForm.replyTarget));

const replyTargetError = computed(() => {
    if (!isReplyMode.value || !destinationForm.replyTarget.trim()) {
        return null;
    }
    if (parsedReplyTarget.value.ok) {
        return null;
    }
    return t(`manage.send.replyTargetErrors.${parsedReplyTarget.value.error}`);
});

const destinationOptions = computed(() => {
    const typeOrder = {
        [CHANNEL_TYPE.GuildText]: 0,
        [CHANNEL_TYPE.GuildAnnouncement]: 1,
        [CHANNEL_TYPE.GuildForum]: 2,
        [CHANNEL_TYPE.AnnouncementThread]: 3,
        [CHANNEL_TYPE.PublicThread]: 4,
        [CHANNEL_TYPE.PrivateThread]: 5
    };

    return channels.value
        .map((channel) => {
            const parent = channel.parentId ? channelById.value.get(channel.parentId) : null;
            const typeKey = channelTypeKey(channel.type);
            const prefix = channelPrefix(channel.type);
            const nsfw = channel.nsfw ? ` ${t('manage.send.nsfw')}` : '';
            const parentLabel = parent ? ` · #${parent.name}` : '';

            return {
                label: `${prefix}${channel.name}${nsfw} [${t(`manage.send.channelTypes.${typeKey}`)}]${parentLabel}`,
                value: channel.id,
                type: channel.type,
                sortKey: `${typeOrder[channel.type] ?? 9}-${channel.name.toLowerCase()}`
            };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
});

const parsedEmbeds = computed(() => parseEmbedJsonInput(messageForm.embedJson));

const previewContent = computed(() => (messageForm.format === 'text' ? messageForm.content : ''));

const previewEmbeds = computed(() => {
    if (messageForm.format !== 'embed' || !parsedEmbeds.value.ok) {
        return [];
    }
    return parsedEmbeds.value.embeds;
});

const previewError = computed(() => {
    if (messageForm.format !== 'embed') {
        return null;
    }
    if (!messageForm.embedJson.trim()) {
        return t('manage.send.previewEmptyEmbed');
    }
    if (!parsedEmbeds.value.ok) {
        return t(`manage.send.embedErrors.${parsedEmbeds.value.error}`);
    }
    return null;
});

const canSend = computed(() => {
    if (sending.value) {
        return false;
    }

    if (isReplyMode.value) {
        if (!parsedReplyTarget.value.ok) {
            return false;
        }
    } else if (!destinationForm.channelId) {
        return false;
    }

    if (showThreadName.value && !destinationForm.threadName.trim()) {
        return false;
    }

    if (messageForm.format === 'text') {
        return Boolean(messageForm.content.trim()) || hasAttachments.value;
    }
    return parsedEmbeds.value.ok || hasAttachments.value;
});

function channelTypeKey(type) {
    switch (type) {
        case CHANNEL_TYPE.GuildText:
            return 'text';
        case CHANNEL_TYPE.GuildAnnouncement:
            return 'announcement';
        case CHANNEL_TYPE.GuildForum:
            return 'forum';
        case CHANNEL_TYPE.PublicThread:
            return 'publicThread';
        case CHANNEL_TYPE.PrivateThread:
            return 'privateThread';
        case CHANNEL_TYPE.AnnouncementThread:
            return 'announcementThread';
        default:
            return 'unknown';
    }
}

function channelPrefix(type) {
    switch (type) {
        case CHANNEL_TYPE.GuildForum:
            return '📋 ';
        case CHANNEL_TYPE.PublicThread:
        case CHANNEL_TYPE.PrivateThread:
        case CHANNEL_TYPE.AnnouncementThread:
            return '🧵 ';
        default:
            return '#';
    }
}

function resetMessageForm() {
    messageForm.format = 'text';
    messageForm.content = '';
    messageForm.embedJson = DEFAULT_EMBED_TEMPLATE;
    clearAttachments();
}

function attachmentErrorMessage(error) {
    const key = `manage.send.attachmentErrors.${error}`;
    const translated = t(key);
    return translated === key ? t('manage.send.attachmentAddFailed') : translated;
}

function notifyAttachmentResult(result) {
    if (!result?.ok) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: attachmentErrorMessage(result.error),
            life: 4000
        });
        return;
    }
    if (result.truncated) {
        toast.add({
            severity: 'info',
            summary: t('manage.send.attachmentsTruncated'),
            detail: t('manage.send.attachmentsTruncatedDetail', { max: maxAttachments }),
            life: 4000
        });
    }
}

function openFilePicker() {
    fileInputRef.value?.click();
}

function onFileInputChange(event) {
    const result = addFiles(event.target.files);
    notifyAttachmentResult(result);
    event.target.value = '';
}

function onMessagePaste(event) {
    const result = handlePaste(event);
    if (result) {
        notifyAttachmentResult(result);
    }
}

function buildFormData() {
    const formData = new FormData();
    const reason = destinationForm.reason.trim();

    if (reason) {
        formData.append('reason', reason);
    }

    if (messageForm.format === 'text') {
        const content = messageForm.content.trim();
        if (content) {
            formData.append('content', content);
        }
    } else if (parsedEmbeds.value.ok) {
        formData.append('embeds', JSON.stringify(parsedEmbeds.value.payload));
    }

    if (isReplyMode.value && parsedReplyTarget.value.ok) {
        formData.append('channelId', parsedReplyTarget.value.channelId);
        formData.append('messageId', parsedReplyTarget.value.messageId);
        formData.append('failIfNotExists', 'true');
    } else {
        formData.append('channelId', destinationForm.channelId);
        if (showThreadName.value) {
            formData.append('threadName', destinationForm.threadName.trim());
        }
    }

    for (const entry of attachments.value) {
        formData.append('attachments', entry.file);
    }

    return formData;
}

function resetDestinationForm() {
    destinationForm.mode = 'send';
    destinationForm.channelId = null;
    destinationForm.threadName = '';
    destinationForm.replyTarget = '';
    destinationForm.reason = '';
    if (!channels.value.length) {
        loadChannels();
    }
}

watch(
    () => destinationForm.mode,
    (mode) => {
        if (mode === 'reply') {
            destinationForm.channelId = null;
            destinationForm.threadName = '';
            return;
        }

        destinationForm.replyTarget = '';
        if (!channels.value.length && !loadingChannels.value) {
            loadChannels();
        }
    }
);

async function loadChannels() {
    loadingChannels.value = true;
    try {
        const response = await fetch('/api/discord/channels', { credentials: 'include' });
        if (!response.ok) {
            throw new Error('failed_to_load');
        }
        channels.value = await response.json();
    } catch {
        toast.add({
            severity: 'error',
            summary: t('toast.loadFailed'),
            detail: t('manage.send.loadChannelsFailed'),
            life: 4000
        });
    } finally {
        loadingChannels.value = false;
    }
}

function buildPayload() {
    const payload = {
        reason: destinationForm.reason.trim() || undefined
    };

    if (messageForm.format === 'text') {
        payload.content = messageForm.content.trim();
    } else if (parsedEmbeds.value.ok) {
        payload.embeds = parsedEmbeds.value.payload;
    }

    if (isReplyMode.value && parsedReplyTarget.value.ok) {
        payload.channelId = parsedReplyTarget.value.channelId;
        payload.messageId = parsedReplyTarget.value.messageId;
        payload.failIfNotExists = true;
        return payload;
    }

    payload.channelId = destinationForm.channelId;

    if (showThreadName.value) {
        payload.threadName = destinationForm.threadName.trim();
    }

    return payload;
}

function sendErrorMessage(error) {
    const key = `manage.send.sendErrors.${error}`;
    const translated = t(key);
    return translated === key ? t('manage.send.sendFailed') : translated;
}

async function sendMessage() {
    if (!canSend.value) {
        toast.add({
            severity: 'warn',
            summary: t('toast.validation'),
            detail: replyTargetError.value ?? t('manage.send.validationDetail'),
            life: 4000
        });
        return;
    }

    sending.value = true;
    try {
        const endpoint = isReplyMode.value ? '/api/discord/messages/reply' : '/api/discord/messages/send';
        const useMultipart = hasAttachments.value;
        const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: useMultipart ? undefined : { 'Content-Type': 'application/json' },
            body: useMultipart ? buildFormData() : JSON.stringify(buildPayload())
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error ?? 'send_failed');
        }

        toast.add({
            severity: 'success',
            summary: t('manage.send.sendSuccess'),
            detail: t('manage.send.sendSuccessDetail', { messageId: data.messageId }),
            life: 5000
        });

        if (messageForm.format === 'text') {
            messageForm.content = '';
        }
        clearAttachments();
        if (isReplyMode.value) {
            destinationForm.replyTarget = '';
        }
        if (showThreadName.value) {
            destinationForm.threadName = '';
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: t('toast.actionFailed'),
            detail: sendErrorMessage(error.message),
            life: 6000
        });
    } finally {
        sending.value = false;
    }
}

onMounted(() => {
    if (destinationForm.mode === 'send') {
        loadChannels();
    }
});
</script>

<template>
    <Fluid>
        <div class="flex flex-col gap-8">
            <div class="card flex flex-col gap-6">
                <div>
                    <div class="font-semibold text-xl">{{ t('manage.send.title') }}</div>
                    <p class="text-muted-color m-0 mt-1">{{ t('manage.send.description') }}</p>
                </div>

                <div class="grid grid-cols-12 gap-4">
                    <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                        <label>{{ t('manage.send.sendMode') }}</label>
                        <SelectButton
                            v-model="destinationForm.mode"
                            :options="sendModeOptions"
                            optionLabel="label"
                            optionValue="value"
                            :allowEmpty="false"
                            :disabled="sending"
                        />
                    </div>

                    <div v-if="!isReplyMode" class="col-span-12 md:col-span-8 flex flex-col gap-2">
                        <label for="send-channel">{{ t('manage.send.destination') }}</label>
                        <Select
                            id="send-channel"
                            v-model="destinationForm.channelId"
                            :options="destinationOptions"
                            optionLabel="label"
                            optionValue="value"
                            filter
                            showClear
                            :placeholder="t('manage.send.selectDestination')"
                            class="w-full"
                            :disabled="loadingChannels || sending"
                            :loading="loadingChannels"
                        />
                    </div>

                    <div v-else class="col-span-12 md:col-span-8 flex flex-col gap-2">
                        <label for="send-reply-target">{{ t('manage.send.replyTarget') }}</label>
                        <InputText
                            id="send-reply-target"
                            v-model="destinationForm.replyTarget"
                            :placeholder="t('manage.send.replyTargetPlaceholder')"
                            class="w-full font-mono"
                            :disabled="sending"
                            :invalid="Boolean(replyTargetError)"
                        />
                        <small v-if="replyTargetError" class="text-red-400">{{ replyTargetError }}</small>
                        <small v-else class="text-muted-color">{{ t('manage.send.replyTargetHint') }}</small>
                    </div>

                    <div v-if="showThreadName" class="col-span-12 md:col-span-6 flex flex-col gap-2">
                        <label for="send-thread-name">{{ t('manage.send.threadName') }}</label>
                        <InputText
                            id="send-thread-name"
                            v-model="destinationForm.threadName"
                            :placeholder="t('manage.send.threadNamePlaceholder')"
                            class="w-full"
                            maxlength="100"
                            :disabled="sending"
                        />
                    </div>

                    <div class="col-span-12 flex flex-col gap-2">
                        <label for="send-reason">{{ t('manage.send.reasonOptional') }}</label>
                        <InputText
                            id="send-reason"
                            v-model="destinationForm.reason"
                            :placeholder="t('manage.messages.reasonAuditPlaceholder')"
                            class="w-full"
                            :disabled="sending"
                        />
                    </div>
                </div>

                <div v-if="selectedChannel" class="destination-summary">
                    <Tag
                        :value="t(`manage.send.channelTypes.${channelTypeKey(selectedChannel.type)}`)"
                        severity="secondary"
                    />
                    <span class="text-muted-color">{{ selectedChannel.id }}</span>
                </div>
                <div v-else-if="isReplyMode && parsedReplyTarget.ok" class="destination-summary">
                    <Tag :value="t('manage.send.modeReply')" severity="secondary" />
                    <span class="text-muted-color font-mono text-sm">
                        {{ parsedReplyTarget.channelId }} / {{ parsedReplyTarget.messageId }}
                    </span>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-8">
                <div class="col-span-12 xl:col-span-6 card flex flex-col gap-6" @paste="onMessagePaste">
                    <div>
                        <div class="font-semibold text-xl">{{ t('manage.send.messageSection') }}</div>
                        <p class="text-muted-color m-0 mt-1">{{ t('manage.send.messageSectionDescription') }}</p>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <label>{{ t('manage.send.attachments') }}</label>
                            <span class="text-muted-color text-sm">
                                {{ t('manage.send.attachmentCount', { count: attachmentCount, max: maxAttachments }) }}
                            </span>
                        </div>
                        <input
                            ref="fileInputRef"
                            type="file"
                            class="hidden"
                            multiple
                            :disabled="sending || attachmentCount >= maxAttachments"
                            @change="onFileInputChange"
                        />
                        <div class="flex flex-wrap gap-2">
                            <Button
                                :label="t('manage.send.addAttachment')"
                                icon="pi pi-paperclip"
                                severity="secondary"
                                outlined
                                :disabled="sending || attachmentCount >= maxAttachments"
                                @click="openFilePicker"
                            />
                        </div>
                        <small class="text-muted-color">{{ t('manage.send.attachmentPasteHint') }}</small>
                        <div v-if="attachments.length" class="attachment-list">
                            <div v-for="entry in attachments" :key="entry.id" class="attachment-item">
                                <img
                                    v-if="entry.previewUrl"
                                    :src="entry.previewUrl"
                                    :alt="entry.file.name"
                                    class="attachment-thumb"
                                />
                                <div v-else class="attachment-file-icon">
                                    <i class="pi pi-file" />
                                </div>
                                <div class="attachment-meta min-w-0">
                                    <div class="attachment-name">{{ entry.file.name }}</div>
                                    <div class="text-muted-color text-sm">{{ formatFileSize(entry.file.size) }}</div>
                                </div>
                                <Button
                                    icon="pi pi-times"
                                    severity="danger"
                                    text
                                    rounded
                                    :disabled="sending"
                                    @click="removeAttachment(entry.id)"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>{{ t('manage.send.messageFormat') }}</label>
                        <SelectButton
                            v-model="messageForm.format"
                            :options="messageFormatOptions"
                            optionLabel="label"
                            optionValue="value"
                            :allowEmpty="false"
                            :disabled="sending"
                        />
                    </div>

                    <div v-if="messageForm.format === 'text'" class="flex flex-col gap-2">
                        <label for="send-content">{{ t('manage.send.textContent') }}</label>
                        <Textarea
                            id="send-content"
                            v-model="messageForm.content"
                            rows="12"
                            class="w-full font-mono"
                            :placeholder="t('manage.send.textContentPlaceholder')"
                            :disabled="sending"
                        />
                        <small class="text-muted-color">{{ t('manage.send.markdownHint') }}</small>
                    </div>

                    <div v-else class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <label for="send-embed-json">{{ t('manage.send.embedJson') }}</label>
                            <Button
                                :label="t('manage.send.resetEmbedTemplate')"
                                icon="pi pi-refresh"
                                severity="secondary"
                                text
                                size="small"
                                :disabled="sending"
                                @click="messageForm.embedJson = DEFAULT_EMBED_TEMPLATE"
                            />
                        </div>
                        <Textarea
                            id="send-embed-json"
                            v-model="messageForm.embedJson"
                            rows="16"
                            class="w-full font-mono text-sm"
                            :disabled="sending"
                        />
                        <small class="text-muted-color">{{ t('manage.send.embedJsonHint') }}</small>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <Button
                            :label="t('manage.send.sendButton')"
                            icon="pi pi-send"
                            :loading="sending"
                            :disabled="!canSend"
                            @click="sendMessage"
                        />
                        <Button
                            :label="t('manage.send.resetButton')"
                            icon="pi pi-refresh"
                            severity="secondary"
                            outlined
                            :disabled="sending"
                            @click="resetMessageForm"
                        />
                        <Button
                            :label="t('manage.send.resetDestinationButton')"
                            icon="pi pi-map-marker"
                            severity="secondary"
                            text
                            :disabled="sending"
                            @click="resetDestinationForm"
                        />
                    </div>
                </div>

                <div class="col-span-12 xl:col-span-6 card flex flex-col gap-4">
                    <div>
                        <div class="font-semibold text-xl">{{ t('manage.send.preview') }}</div>
                        <p class="text-muted-color m-0 mt-1">{{ t('manage.send.previewDescription') }}</p>
                    </div>

                    <div class="preview-shell">
                        <Message v-if="previewError" severity="warn" :closable="false">
                            {{ previewError }}
                        </Message>
                        <div v-else-if="messageForm.format === 'embed' && !messageForm.embedJson.trim()" class="preview-empty">
                            {{ t('manage.send.previewEmptyEmbed') }}
                        </div>
                        <div v-else-if="!previewContent && !previewEmbeds.length && !attachments.length" class="preview-empty">
                            {{ t('manage.send.previewEmptyText') }}
                        </div>
                        <template v-else>
                            <DiscordEmbedPreview :content="previewContent" :embeds="previewEmbeds" />
                            <div v-if="attachments.length" class="preview-attachments">
                                <div class="font-medium text-sm mb-2">{{ t('manage.send.attachments') }}</div>
                                <div class="attachment-preview-grid">
                                    <div v-for="entry in attachments" :key="entry.id" class="attachment-preview-item">
                                        <img
                                            v-if="entry.previewUrl"
                                            :src="entry.previewUrl"
                                            :alt="entry.file.name"
                                            class="attachment-preview-image"
                                        />
                                        <div v-else class="attachment-preview-file">
                                            <i class="pi pi-file" />
                                            <span>{{ entry.file.name }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </Fluid>
</template>

<style scoped>
.destination-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.25rem;
}

.preview-shell {
    min-height: 18rem;
    padding: 1rem;
    border-radius: 8px;
    background: #313338;
    border: 1px solid var(--surface-border);
}

.preview-empty {
    color: #b5bac1;
    font-style: italic;
}

.attachment-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.attachment-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
}

.attachment-thumb {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
}

.attachment-file-icon {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--surface-100);
    flex-shrink: 0;
}

.attachment-name {
    word-break: break-all;
}

.preview-attachments {
    margin-top: 0.75rem;
}

.attachment-preview-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.attachment-preview-item {
    max-width: 12rem;
}

.attachment-preview-image {
    max-width: 12rem;
    max-height: 12rem;
    border-radius: 6px;
    object-fit: contain;
}

.attachment-preview-file {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #dbdee1;
    word-break: break-all;
}
</style>
