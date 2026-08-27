<script setup>
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

const toast = useToast();

const SEARCH_HAS_TYPES = ['image', 'sound', 'video', 'file', 'sticker', 'embed', 'link', 'poll', 'snapshot'];
const SEARCH_AUTHOR_TYPES = ['user', 'bot', 'webhook'];
const SEARCH_EMBED_TYPES = ['image', 'video', 'gif', 'sound', 'article'];
const SEARCH_SORT_BY = ['timestamp', 'relevance'];
const SEARCH_SORT_ORDER = ['asc', 'desc'];

const BASIC_HAS_TYPES = ['image', 'link', 'file', 'video', 'embed', 'sound'];

const loadingOptions = ref(true);
const searching = ref(false);
const deleting = ref(false);

const members = ref([]);
const channels = ref([]);

const messages = ref([]);
const selectedMessages = ref([]);
const totalResults = ref(0);
const currentOffset = ref(0);

const showAdvanced = ref(false);

const basicForm = reactive({
    authorIds: [],
    channelIds: [],
    has: [],
    content: ''
});

const advancedForm = reactive({
    limit: 25,
    maxId: '',
    minId: '',
    slop: null,
    authorTypes: [],
    mentionIds: [],
    mentionRoleIds: [],
    mentionEveryone: null,
    repliedToUserIds: [],
    repliedToMessageIds: [],
    pinned: null,
    has: [],
    embedTypes: [],
    embedProviders: '',
    linkHostnames: '',
    attachmentFilenames: '',
    attachmentExtensions: '',
    sortBy: 'timestamp',
    sortOrder: 'desc',
    includeNsfw: false
});

const deleteDialog = reactive({
    visible: false,
    reason: ''
});

const tableFilters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const triStateOptions = [
    { label: 'Any', value: null },
    { label: 'Yes', value: true },
    { label: 'No', value: false }
];

const limitOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 }
];

const selectedCount = computed(() => selectedMessages.value.length);
const pageSize = computed(() => (showAdvanced.value ? advancedForm.limit : 25));
const pageStart = computed(() => (totalResults.value === 0 ? 0 : currentOffset.value + 1));
const pageEnd = computed(() => Math.min(currentOffset.value + messages.value.length, totalResults.value));
const canGoPrev = computed(() => currentOffset.value > 0);
const canGoNext = computed(() => currentOffset.value + pageSize.value < totalResults.value);

const channelNameById = computed(() => {
    const map = new Map();
    for (const channel of channels.value) {
        map.set(channel.id, channel.name);
    }
    return map;
});

const memberOptions = computed(() =>
    members.value.map((member) => ({
        label: `${member.displayName} (@${member.username})`,
        value: member.id,
        avatarURL: member.guildAvatarURL || member.avatarURL,
        displayName: member.displayName,
        username: member.username
    }))
);

const channelOptions = computed(() =>
    channels.value.map((channel) => ({
        label: channel.nsfw ? `#${channel.name} (NSFW)` : `#${channel.name}`,
        value: channel.id
    }))
);

const roleOptions = computed(() => {
    const map = new Map();
    for (const member of members.value) {
        for (const role of member.roles ?? []) {
            if (role.name === '@everyone' || map.has(role.id)) {
                continue;
            }
            map.set(role.id, {
                label: role.name,
                value: role.id,
                hexColor: role.hexColor
            });
        }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
});

const basicHasOptions = computed(() =>
    BASIC_HAS_TYPES.map((value) => ({
        label: formatHasLabel(value),
        value
    }))
);

const advancedHasOptions = computed(() =>
    SEARCH_HAS_TYPES.flatMap((value) => [
        { label: formatHasLabel(value), value },
        { label: `Not ${formatHasLabel(value)}`, value: `-${value}` }
    ])
);

const authorTypeOptions = computed(() =>
    SEARCH_AUTHOR_TYPES.flatMap((value) => [
        { label: formatAuthorTypeLabel(value), value },
        { label: `Not ${formatAuthorTypeLabel(value)}`, value: `-${value}` }
    ])
);

const embedTypeOptions = computed(() =>
    SEARCH_EMBED_TYPES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value
    }))
);

const sortByOptions = computed(() =>
    SEARCH_SORT_BY.map((value) => ({
        label: value === 'timestamp' ? 'Timestamp' : 'Relevance',
        value
    }))
);

const sortOrderOptions = computed(() =>
    SEARCH_SORT_ORDER.map((value) => ({
        label: value === 'asc' ? 'Ascending' : 'Descending',
        value
    }))
);

function formatHasLabel(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAuthorTypeLabel(value) {
    switch (value) {
        case 'user':
            return 'User';
        case 'bot':
            return 'Bot';
        case 'webhook':
            return 'Webhook';
        default:
            return value;
    }
}

function splitLines(value) {
    return value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function snowflakeListFromText(value) {
    return splitLines(value).filter((entry) => /^\d{17,20}$/.test(entry));
}

function buildSearchQuery() {
    const query = {
        limit: pageSize.value,
        offset: currentOffset.value
    };

    const content = basicForm.content.trim();
    if (content) {
        query.content = content;
    }
    if (basicForm.channelIds.length) {
        query.channel_id = [...basicForm.channelIds];
    }
    if (basicForm.authorIds.length) {
        query.author_id = [...basicForm.authorIds];
    }

    const hasValues = showAdvanced.value
        ? advancedForm.has.length
            ? [...advancedForm.has]
            : [...basicForm.has]
        : [...basicForm.has];
    if (hasValues.length) {
        query.has = hasValues;
    }

    if (showAdvanced.value) {
        if (advancedForm.maxId.trim()) {
            query.max_id = advancedForm.maxId.trim();
        }
        if (advancedForm.minId.trim()) {
            query.min_id = advancedForm.minId.trim();
        }
        if (advancedForm.slop != null && advancedForm.slop !== '') {
            query.slop = Number(advancedForm.slop);
        }
        if (advancedForm.authorTypes.length) {
            query.author_type = [...advancedForm.authorTypes];
        }
        if (advancedForm.mentionIds.length) {
            query.mentions = [...advancedForm.mentionIds];
        }
        if (advancedForm.mentionRoleIds.length) {
            query.mentions_role_id = [...advancedForm.mentionRoleIds];
        }
        if (advancedForm.mentionEveryone !== null) {
            query.mention_everyone = advancedForm.mentionEveryone;
        }
        if (advancedForm.repliedToUserIds.length) {
            query.replied_to_user_id = [...advancedForm.repliedToUserIds];
        }
        if (advancedForm.repliedToMessageIds.length) {
            query.replied_to_message_id = snowflakeListFromText(advancedForm.repliedToMessageIds);
        }
        if (advancedForm.pinned !== null) {
            query.pinned = advancedForm.pinned;
        }
        if (advancedForm.embedTypes.length) {
            query.embed_type = [...advancedForm.embedTypes];
        }

        const embedProviders = splitLines(advancedForm.embedProviders);
        if (embedProviders.length) {
            query.embed_provider = embedProviders;
        }
        const linkHostnames = splitLines(advancedForm.linkHostnames);
        if (linkHostnames.length) {
            query.link_hostname = linkHostnames;
        }
        const attachmentFilenames = splitLines(advancedForm.attachmentFilenames);
        if (attachmentFilenames.length) {
            query.attachment_filename = attachmentFilenames;
        }
        const attachmentExtensions = splitLines(advancedForm.attachmentExtensions);
        if (attachmentExtensions.length) {
            query.attachment_extension = attachmentExtensions;
        }

        query.sort_by = advancedForm.sortBy;
        query.sort_order = advancedForm.sortOrder;
        query.include_nsfw = advancedForm.includeNsfw;
    }

    return query;
}

function flattenMessages(response) {
    const rows = [];
    const seen = new Set();

    for (const group of response.messages ?? []) {
        for (const message of group) {
            if (!message?.id || seen.has(message.id)) {
                continue;
            }
            seen.add(message.id);
            rows.push(message);
        }
    }

    return rows;
}

function authorDisplayName(author) {
    return author?.global_name || author?.username || author?.id || 'Unknown';
}

function authorAvatarUrl(author) {
    if (!author?.id) {
        return null;
    }
    if (author.avatar) {
        return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`;
    }
    const defaultIndex = Number(BigInt(author.id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

function formatDate(value) {
    if (!value) {
        return '—';
    }
    return new Date(value).toLocaleString();
}

function formatChannelName(channelId) {
    const name = channelNameById.value.get(channelId);
    return name ? `#${name}` : channelId;
}

function messagePreview(message) {
    const text = message.content?.trim();
    if (text) {
        return text;
    }
    if (message.attachments?.length) {
        return `[${message.attachments.length} attachment${message.attachments.length === 1 ? '' : 's'}]`;
    }
    if (message.embeds?.length) {
        return `[${message.embeds.length} embed${message.embeds.length === 1 ? '' : 's'}]`;
    }
    return '—';
}

function messageFlags(message) {
    const flags = [];
    if (message.pinned) {
        flags.push('Pinned');
    }
    if (message.attachments?.length) {
        flags.push('File');
    }
    if (message.embeds?.length) {
        flags.push('Embed');
    }
    if (message.sticker_items?.length) {
        flags.push('Sticker');
    }
    return flags;
}

function clearTableFilter() {
    tableFilters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}

function resetForms() {
    basicForm.authorIds = [];
    basicForm.channelIds = [];
    basicForm.has = [];
    basicForm.content = '';

    advancedForm.limit = 25;
    advancedForm.maxId = '';
    advancedForm.minId = '';
    advancedForm.slop = null;
    advancedForm.authorTypes = [];
    advancedForm.mentionIds = [];
    advancedForm.mentionRoleIds = [];
    advancedForm.mentionEveryone = null;
    advancedForm.repliedToUserIds = [];
    advancedForm.repliedToMessageIds = '';
    advancedForm.pinned = null;
    advancedForm.has = [];
    advancedForm.embedTypes = [];
    advancedForm.embedProviders = '';
    advancedForm.linkHostnames = '';
    advancedForm.attachmentFilenames = '';
    advancedForm.attachmentExtensions = '';
    advancedForm.sortBy = 'timestamp';
    advancedForm.sortOrder = 'desc';
    advancedForm.includeNsfw = false;

    currentOffset.value = 0;
}

async function loadOptions() {
    loadingOptions.value = true;
    try {
        const [membersResponse, channelsResponse] = await Promise.all([
            fetch('/api/discord/members', { credentials: 'include' }),
            fetch('/api/discord/channels', { credentials: 'include' })
        ]);

        if (membersResponse.ok) {
            members.value = await membersResponse.json();
        }
        if (channelsResponse.ok) {
            channels.value = await channelsResponse.json();
        }

        if (!membersResponse.ok || !channelsResponse.ok) {
            toast.add({
                severity: 'warn',
                summary: 'Partial load',
                detail: 'Some search filter options could not be loaded.',
                life: 4000
            });
        }
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Load failed',
            detail: 'Could not load members or channels for search filters.',
            life: 4000
        });
    } finally {
        loadingOptions.value = false;
    }
}

async function searchMessages(resetOffset = true) {
    if (resetOffset) {
        currentOffset.value = 0;
    }

    searching.value = true;
    selectedMessages.value = [];

    try {
        const response = await fetch('/api/discord/messages/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(buildSearchQuery())
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (data.error === 'index_not_ready') {
                const retryAfter = data.retry_after ? ` Retry after ${data.retry_after}s.` : '';
                throw new Error(`index_not_ready:${retryAfter}`);
            }
            throw new Error(data.error ?? 'search_failed');
        }

        messages.value = flattenMessages(data);
        totalResults.value = data.total_results ?? messages.value.length;
    } catch (error) {
        messages.value = [];
        totalResults.value = 0;

        const detail =
            error.message === 'invalid_query'
                ? 'Search parameters are invalid.'
                : error.message.startsWith('index_not_ready:')
                  ? `Discord search index is not ready yet.${error.message.slice('index_not_ready:'.length)}`
                  : error.message === 'bot_not_connected'
                    ? 'The Discord bot is not connected.'
                    : 'Could not search messages.';

        toast.add({
            severity: 'error',
            summary: 'Search failed',
            detail,
            life: 6000
        });
    } finally {
        searching.value = false;
    }
}

function goPrevPage() {
    if (!canGoPrev.value || searching.value) {
        return;
    }
    currentOffset.value = Math.max(0, currentOffset.value - pageSize.value);
    searchMessages(false);
}

function goNextPage() {
    if (!canGoNext.value || searching.value) {
        return;
    }
    currentOffset.value += pageSize.value;
    searchMessages(false);
}

function openDeleteDialog() {
    if (!selectedMessages.value.length) {
        toast.add({
            severity: 'warn',
            summary: 'No selection',
            detail: 'Select at least one message first.',
            life: 3000
        });
        return;
    }

    deleteDialog.reason = '';
    deleteDialog.visible = true;
}

async function confirmDelete() {
    const targets = [...selectedMessages.value];
    deleting.value = true;

    let succeeded = 0;
    const failures = [];

    for (const message of targets) {
        try {
            const response = await fetch('/api/discord/messages/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    channelId: message.channel_id,
                    messageId: message.id,
                    reason: deleteDialog.reason.trim() || undefined
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error ?? 'delete_failed');
            }
            succeeded += 1;
        } catch (error) {
            failures.push({
                id: message.id,
                error: error.message
            });
        }
    }

    deleting.value = false;
    deleteDialog.visible = false;

    toast.add({
        severity: failures.length ? 'warn' : 'success',
        summary: 'Delete complete',
        detail:
            failures.length === 0
                ? `Deleted ${succeeded} message${succeeded === 1 ? '' : 's'}.`
                : `Deleted ${succeeded}, failed ${failures.length}.`,
        life: failures.length ? 10000 : 4000
    });

    await searchMessages(false);
}

onMounted(loadOptions);
</script>

<template>
    <Fluid>
        <div class="flex flex-col gap-8">
            <div class="card flex flex-col gap-6">
                <div>
                    <div class="font-semibold text-xl">Message Search</div>
                    <p class="text-muted-color m-0 mt-1">Search guild messages and delete selected results in bulk.</p>
                </div>

                <div class="grid grid-cols-12 gap-4">
                    <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                        <label for="search-authors">Authors</label>
                        <MultiSelect
                            id="search-authors"
                            v-model="basicForm.authorIds"
                            :options="memberOptions"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            filter
                            placeholder="Select users"
                            class="w-full"
                            :disabled="loadingOptions || searching"
                            :maxSelectedLabels="3"
                        >
                            <template #option="{ option }">
                                <div class="flex items-center gap-2 min-w-0">
                                    <img :src="option.avatarURL" :alt="option.displayName" class="option-avatar" />
                                    <div class="min-w-0">
                                        <div class="truncate">{{ option.displayName }}</div>
                                        <div class="text-muted-color text-sm truncate">@{{ option.username }}</div>
                                    </div>
                                </div>
                            </template>
                        </MultiSelect>
                    </div>

                    <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                        <label for="search-channels">Channels</label>
                        <MultiSelect
                            id="search-channels"
                            v-model="basicForm.channelIds"
                            :options="channelOptions"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            filter
                            placeholder="Select channels"
                            class="w-full"
                            :disabled="loadingOptions || searching"
                            :maxSelectedLabels="3"
                        />
                    </div>

                    <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                        <label for="search-has">Contains</label>
                        <MultiSelect
                            id="search-has"
                            v-model="basicForm.has"
                            :options="basicHasOptions"
                            optionLabel="label"
                            optionValue="value"
                            display="chip"
                            placeholder="Links, images, files..."
                            class="w-full"
                            :disabled="searching"
                            :maxSelectedLabels="4"
                        />
                    </div>

                    <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                        <label for="search-content">Content</label>
                        <InputText
                            id="search-content"
                            v-model="basicForm.content"
                            placeholder="Search message text"
                            class="w-full"
                            :disabled="searching"
                            @keyup.enter="searchMessages(true)"
                        />
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <Button
                        :label="showAdvanced ? 'Hide advanced search' : 'Advanced search'"
                        :icon="showAdvanced ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                        severity="secondary"
                        text
                        :disabled="searching"
                        @click="showAdvanced = !showAdvanced"
                    />
                </div>

                <div v-if="showAdvanced" class="advanced-panel flex flex-col gap-4">
                    <Divider />

                    <div class="grid grid-cols-12 gap-4">
                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-limit">Results per page</label>
                            <Select
                                id="search-limit"
                                v-model="advancedForm.limit"
                                :options="limitOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-sort-by">Sort by</label>
                            <Select
                                id="search-sort-by"
                                v-model="advancedForm.sortBy"
                                :options="sortByOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-sort-order">Sort order</label>
                            <Select
                                id="search-sort-order"
                                v-model="advancedForm.sortOrder"
                                :options="sortOrderOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                :disabled="searching || advancedForm.sortBy === 'relevance'"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-max-id">Max message ID</label>
                            <InputText id="search-max-id" v-model="advancedForm.maxId" placeholder="Snowflake ID" class="w-full" :disabled="searching" />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-min-id">Min message ID</label>
                            <InputText id="search-min-id" v-model="advancedForm.minId" placeholder="Snowflake ID" class="w-full" :disabled="searching" />
                        </div>

                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-slop">Content slop</label>
                            <InputNumber id="search-slop" v-model="advancedForm.slop" :min="0" :max="100" class="w-full" :disabled="searching" />
                        </div>

                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-mention-everyone">Mentions @everyone</label>
                            <Select
                                id="search-mention-everyone"
                                v-model="advancedForm.mentionEveryone"
                                :options="triStateOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
                            <label for="search-pinned">Pinned</label>
                            <Select
                                id="search-pinned"
                                v-model="advancedForm.pinned"
                                :options="triStateOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-author-types">Author types</label>
                            <MultiSelect
                                id="search-author-types"
                                v-model="advancedForm.authorTypes"
                                :options="authorTypeOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                filter
                                placeholder="User, bot, webhook..."
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-has-advanced">Has (advanced)</label>
                            <MultiSelect
                                id="search-has-advanced"
                                v-model="advancedForm.has"
                                :options="advancedHasOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                filter
                                placeholder="Include or exclude content types"
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-mentions">Mentioned users</label>
                            <MultiSelect
                                id="search-mentions"
                                v-model="advancedForm.mentionIds"
                                :options="memberOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                filter
                                placeholder="Select mentioned users"
                                class="w-full"
                                :disabled="loadingOptions || searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-mention-roles">Mentioned roles</label>
                            <MultiSelect
                                id="search-mention-roles"
                                v-model="advancedForm.mentionRoleIds"
                                :options="roleOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                filter
                                placeholder="Select roles"
                                class="w-full"
                                :disabled="loadingOptions || searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-replied-users">Replied-to users</label>
                            <MultiSelect
                                id="search-replied-users"
                                v-model="advancedForm.repliedToUserIds"
                                :options="memberOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                filter
                                placeholder="Select users"
                                class="w-full"
                                :disabled="loadingOptions || searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-replied-messages">Replied-to message IDs</label>
                            <Textarea
                                id="search-replied-messages"
                                v-model="advancedForm.repliedToMessageIds"
                                rows="3"
                                class="w-full"
                                placeholder="One snowflake ID per line"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-embed-types">Embed types</label>
                            <MultiSelect
                                id="search-embed-types"
                                v-model="advancedForm.embedTypes"
                                :options="embedTypeOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                placeholder="Image, video, gif..."
                                class="w-full"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-embed-providers">Embed providers</label>
                            <Textarea
                                id="search-embed-providers"
                                v-model="advancedForm.embedProviders"
                                rows="3"
                                class="w-full"
                                placeholder="One provider per line (e.g. Tenor)"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-link-hostnames">Link hostnames</label>
                            <Textarea
                                id="search-link-hostnames"
                                v-model="advancedForm.linkHostnames"
                                rows="3"
                                class="w-full"
                                placeholder="One hostname per line"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-attachment-filenames">Attachment filenames</label>
                            <Textarea
                                id="search-attachment-filenames"
                                v-model="advancedForm.attachmentFilenames"
                                rows="3"
                                class="w-full"
                                placeholder="One filename per line"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                            <label for="search-attachment-extensions">Attachment extensions</label>
                            <Textarea
                                id="search-attachment-extensions"
                                v-model="advancedForm.attachmentExtensions"
                                rows="3"
                                class="w-full"
                                placeholder="One extension per line (e.g. png)"
                                :disabled="searching"
                            />
                        </div>

                        <div class="col-span-12 flex items-center gap-3">
                            <Checkbox v-model="advancedForm.includeNsfw" inputId="search-include-nsfw" binary :disabled="searching" />
                            <label for="search-include-nsfw">Include age-restricted channels</label>
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3">
                    <Button label="Search" icon="pi pi-search" :loading="searching" @click="searchMessages(true)" />
                    <Button label="Reset" icon="pi pi-refresh" severity="secondary" outlined :disabled="searching" @click="resetForms" />
                </div>
            </div>

            <div class="card">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <div class="font-semibold text-xl">Results</div>
                        <p class="text-muted-color m-0 mt-1">
                            <span v-if="totalResults">{{ pageStart.toLocaleString() }}–{{ pageEnd.toLocaleString() }} of {{ totalResults.toLocaleString() }}</span>
                            <span v-else>No results yet. Run a search to load messages.</span>
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button label="Previous" icon="pi pi-chevron-left" severity="secondary" outlined :disabled="!canGoPrev || searching" @click="goPrevPage" />
                        <Button label="Next" icon="pi pi-chevron-right" iconPos="right" severity="secondary" outlined :disabled="!canGoNext || searching" @click="goNextPage" />
                        <Button
                            label="Delete Selected"
                            icon="pi pi-trash"
                            severity="danger"
                            :disabled="!selectedCount || searching || deleting"
                            @click="openDeleteDialog"
                        />
                    </div>
                </div>

                <DataTable
                    v-model:selection="selectedMessages"
                    v-model:filters="tableFilters"
                    :value="messages"
                    dataKey="id"
                    paginator
                    :rows="10"
                    :rowsPerPageOptions="[10, 25, 50]"
                    :loading="searching"
                    :globalFilterFields="['id', 'content', 'channel_id']"
                    :rowHover="true"
                    showGridlines
                    responsiveLayout="scroll"
                >
                    <template #header>
                        <div class="flex flex-wrap justify-between gap-3">
                            <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined :disabled="searching" @click="clearTableFilter" />
                            <IconField>
                                <InputIcon>
                                    <i class="pi pi-search" />
                                </InputIcon>
                                <InputText v-model="tableFilters['global'].value" placeholder="Filter current results" />
                            </IconField>
                        </div>
                    </template>

                    <template #empty>No messages found.</template>
                    <template #loading>Searching messages. Please wait.</template>

                    <Column selectionMode="multiple" headerStyle="width: 3rem" />

                    <Column field="id" header="Message ID" style="min-width: 12rem">
                        <template #body="{ data }">
                            <span class="font-mono text-sm">{{ data.id }}</span>
                        </template>
                    </Column>

                    <Column header="Channel" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ formatChannelName(data.channel_id) }}
                        </template>
                    </Column>

                    <Column header="Author" style="min-width: 14rem">
                        <template #body="{ data }">
                            <div class="flex items-center gap-3">
                                <img :src="authorAvatarUrl(data.author)" :alt="authorDisplayName(data.author)" class="user-avatar" />
                                <div class="min-w-0">
                                    <div class="font-medium truncate">{{ authorDisplayName(data.author) }}</div>
                                    <div class="text-muted-color text-sm truncate">@{{ data.author?.username ?? 'unknown' }}</div>
                                </div>
                            </div>
                        </template>
                    </Column>

                    <Column header="Content" style="min-width: 18rem">
                        <template #body="{ data }">
                            <div class="message-preview">{{ messagePreview(data) }}</div>
                        </template>
                    </Column>

                    <Column header="Flags" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="flex flex-wrap gap-1">
                                <Tag v-for="flag in messageFlags(data)" :key="flag" :value="flag" severity="secondary" />
                                <span v-if="!messageFlags(data).length" class="text-muted-color">—</span>
                            </div>
                        </template>
                    </Column>

                    <Column header="Sent" style="min-width: 11rem">
                        <template #body="{ data }">
                            {{ formatDate(data.timestamp) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </Fluid>

    <Dialog v-model:visible="deleteDialog.visible" modal header="Delete Messages" :style="{ width: '32rem' }" :closable="!deleting">
        <div class="flex flex-col gap-4">
            <Message severity="warn" :closable="false">
                {{ selectedCount }} message{{ selectedCount === 1 ? '' : 's' }} will be permanently deleted.
            </Message>

            <div class="flex flex-col gap-2">
                <label for="delete-reason">Reason (optional)</label>
                <Textarea
                    id="delete-reason"
                    v-model="deleteDialog.reason"
                    rows="4"
                    class="w-full"
                    :disabled="deleting"
                    placeholder="Audit log reason"
                />
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" outlined :disabled="deleting" @click="deleteDialog.visible = false" />
            <Button label="Delete" severity="danger" icon="pi pi-trash" :loading="deleting" @click="confirmDelete" />
        </template>
    </Dialog>
</template>

<style scoped>
.option-avatar,
.user-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.message-preview {
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 28rem;
}

.advanced-panel {
    border-top: 1px solid var(--surface-border);
}
</style>
