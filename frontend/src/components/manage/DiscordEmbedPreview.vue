<script setup>
import { renderDiscordMarkdown } from '@/utils/discordMarkdown';

defineProps({
    embeds: {
        type: Array,
        default: () => []
    },
    content: {
        type: String,
        default: ''
    }
});
</script>

<template>
    <div class="discord-preview">
        <div v-if="content?.trim()" class="discord-preview-content" v-html="renderDiscordMarkdown(content)" />

        <article v-for="(embed, index) in embeds" :key="index" class="discord-embed" :style="{ borderLeftColor: embed.color || '#4f545c' }">
            <div v-if="embed.author?.name" class="discord-embed-author">
                <img v-if="embed.author.iconURL" :src="embed.author.iconURL" alt="" class="discord-embed-author-icon" />
                <a v-if="embed.author.url" :href="embed.author.url" target="_blank" rel="noopener noreferrer" class="discord-embed-author-name">
                    {{ embed.author.name }}
                </a>
                <span v-else class="discord-embed-author-name">{{ embed.author.name }}</span>
            </div>

            <a v-if="embed.url && embed.title" :href="embed.url" target="_blank" rel="noopener noreferrer" class="discord-embed-title">
                {{ embed.title }}
            </a>
            <div v-else-if="embed.title" class="discord-embed-title">{{ embed.title }}</div>

            <div v-if="embed.description" class="discord-embed-description" v-html="renderDiscordMarkdown(embed.description)" />

            <div v-if="embed.fields?.length" class="discord-embed-fields">
                <div
                    v-for="(field, fieldIndex) in embed.fields"
                    :key="fieldIndex"
                    class="discord-embed-field"
                    :class="{ 'discord-embed-field-inline': field.inline }"
                >
                    <div class="discord-embed-field-name">{{ field.name }}</div>
                    <div class="discord-embed-field-value" v-html="renderDiscordMarkdown(field.value)" />
                </div>
            </div>

            <img v-if="embed.image?.url" :src="embed.image.url" alt="" class="discord-embed-image" />

            <div v-if="embed.footer?.text || embed.timestamp" class="discord-embed-footer">
                <img v-if="embed.footer?.iconURL" :src="embed.footer.iconURL" alt="" class="discord-embed-footer-icon" />
                <span>{{ embed.footer?.text }}</span>
                <span v-if="embed.footer?.text && embed.timestamp"> • </span>
                <span v-if="embed.timestamp">{{ new Date(embed.timestamp).toLocaleString() }}</span>
            </div>

            <img v-if="embed.thumbnail?.url" :src="embed.thumbnail.url" alt="" class="discord-embed-thumbnail" />
        </article>
    </div>
</template>

<style scoped>
.discord-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.discord-preview-content {
    color: #dbdee1;
    line-height: 1.375;
    white-space: pre-wrap;
    word-break: break-word;
}

.discord-embed {
    position: relative;
    max-width: 32rem;
    border-left: 4px solid #4f545c;
    background: #2b2d31;
    border-radius: 4px;
    padding: 0.65rem 1rem 0.8rem 0.75rem;
    color: #dbdee1;
}

.discord-embed-author {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
    min-height: 1.25rem;
}

.discord-embed-author-icon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    object-fit: cover;
}

.discord-embed-author-name,
.discord-embed-title {
    color: #fff;
    font-weight: 600;
}

.discord-embed-title {
    display: block;
    margin-bottom: 0.35rem;
    text-decoration: none;
}

.discord-embed-title:hover {
    text-decoration: underline;
}

.discord-embed-description,
.discord-embed-field-value {
    color: #dbdee1;
    line-height: 1.375;
    white-space: pre-wrap;
    word-break: break-word;
}

.discord-embed-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.discord-embed-field {
    flex: 1 1 100%;
    min-width: 0;
}

.discord-embed-field-inline {
    flex: 1 1 calc(33% - 0.5rem);
}

.discord-embed-field-name {
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.15rem;
}

.discord-embed-image {
    display: block;
    max-width: 100%;
    border-radius: 4px;
    margin-top: 0.75rem;
}

.discord-embed-thumbnail {
    position: absolute;
    top: 0.65rem;
    right: 1rem;
    width: 5rem;
    height: 5rem;
    border-radius: 4px;
    object-fit: cover;
}

.discord-embed-footer {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: #b5bac1;
}

.discord-embed-footer-icon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    object-fit: cover;
}

.discord-preview :deep(.discord-paragraph) {
    margin: 0 0 0.25rem;
}

.discord-preview :deep(.discord-quote) {
    margin: 0.15rem 0;
    padding-left: 0.65rem;
    border-left: 4px solid #4e5058;
    color: #b5bac1;
}

.discord-preview :deep(.discord-inline-code) {
    background: #1e1f22;
    padding: 0.1rem 0.25rem;
    border-radius: 3px;
    font-family: Consolas, Monaco, 'Courier New', monospace;
    font-size: 0.85em;
}

.discord-preview :deep(.discord-codeblock) {
    margin: 0.35rem 0;
    padding: 0.5rem;
    background: #1e1f22;
    border-radius: 4px;
    overflow-x: auto;
    font-family: Consolas, Monaco, 'Courier New', monospace;
    font-size: 0.85em;
}

.discord-preview :deep(.discord-spoiler) {
    background: #1e1f22;
    color: transparent;
    border-radius: 3px;
    padding: 0 2px;
    cursor: pointer;
}

.discord-preview :deep(.discord-spoiler:hover) {
    color: #dbdee1;
    background: #2b2d31;
}

.discord-preview :deep(.discord-mention) {
    background: rgba(88, 101, 242, 0.3);
    color: #c9cdfb;
    border-radius: 3px;
    padding: 0 2px;
    font-weight: 500;
}

.discord-preview :deep(a) {
    color: #00a8fc;
    text-decoration: none;
}

.discord-preview :deep(a:hover) {
    text-decoration: underline;
}
</style>
