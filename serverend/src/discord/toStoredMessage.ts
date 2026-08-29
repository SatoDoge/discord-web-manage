import type { Attachment, Embed, Message, MessageReaction, Sticker } from "discord.js";
import type {
    StoredGuildMessage,
    StoredMessageAttachment,
    StoredMessageEmbed,
    StoredMessageReaction,
} from "#server/types/messageData.js";

function toStoredAttachment(attachment: Attachment): StoredMessageAttachment {
    return {
        attachmentId: attachment.id,
        filename: attachment.name,
        description: attachment.description,
        contentType: attachment.contentType,
        size: attachment.size,
        url: attachment.url,
        proxyURL: attachment.proxyURL,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration ?? null,
        spoiler: attachment.spoiler,
        ephemeral: attachment.ephemeral ?? false,
    };
}

function toStoredEmbed(embed: Embed): StoredMessageEmbed {
    return {
        type: embed.data.type ?? null,
        title: embed.title,
        description: embed.description,
        url: embed.url,
        color: embed.color,
        timestamp: embed.timestamp,
        author: embed.author
            ? {
                  name: embed.author.name,
                  url: embed.author.url ?? null,
                  iconURL: embed.author.iconURL ?? null,
              }
            : null,
        footer: embed.footer
            ? {
                  text: embed.footer.text,
                  iconURL: embed.footer.iconURL ?? null,
              }
            : null,
        imageURL: embed.image?.url ?? null,
        thumbnailURL: embed.thumbnail?.url ?? null,
        videoURL: embed.video?.url ?? null,
        videoWidth: embed.video?.width ?? null,
        videoHeight: embed.video?.height ?? null,
        provider: embed.provider
            ? {
                  name: embed.provider.name ?? null,
                  url: embed.provider.url ?? null,
              }
            : null,
        fields: embed.fields.map((field) => ({
            name: field.name,
            value: field.value,
            inline: field.inline ?? false,
        })),
    };
}

function toStoredReaction(reaction: MessageReaction): StoredMessageReaction {
    return {
        emojiId: reaction.emoji.id,
        emojiName: reaction.emoji.name,
        emojiAnimated: reaction.emoji.animated ?? null,
        count: reaction.count,
        me: reaction.me,
    };
}

function toStoredSticker(sticker: Sticker): StoredGuildMessage["stickers"][number] {
    return {
        stickerId: sticker.id,
        name: sticker.name,
        formatType: sticker.format,
    };
}

export function toStoredGuildMessage(
    message: Message,
    syncedAt = new Date().toISOString(),
): StoredGuildMessage {
    const author = message.author;
    const member = message.member;

    return {
        messageId: message.id,
        guildId: message.guildId!,
        channelId: message.channelId,
        author: {
            userId: author.id,
            username: author.username,
            globalName: author.globalName,
            avatarURL: author.displayAvatarURL({ size: 128 }),
            bot: author.bot,
            system: author.system,
            displayName: member?.displayName ?? null,
        },
        content: message.content,
        cleanContent: message.cleanContent,
        messageType: message.type,
        flags: message.flags.bitfield.toString(),
        tts: message.tts,
        pinned: message.pinned,
        attachments: [...message.attachments.values()].map(toStoredAttachment),
        embeds: message.embeds.map(toStoredEmbed),
        mentions: {
            userIds: [...message.mentions.users.keys()],
            roleIds: [...message.mentions.roles.keys()],
            channelIds: [...message.mentions.channels.keys()],
            everyone: message.mentions.everyone,
            here: false,
        },
        reactions: [...message.reactions.cache.values()].map(toStoredReaction),
        stickers: [...message.stickers.values()].map(toStoredSticker),
        reference: message.reference
            ? {
                  messageId: message.reference.messageId ?? null,
                  channelId: message.reference.channelId,
                  guildId: message.reference.guildId ?? null,
              }
            : null,
        hasThread: message.hasThread,
        threadId: message.thread?.id ?? null,
        webhookId: message.webhookId,
        applicationId: message.applicationId,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        firstSeenAt: syncedAt,
        lastSyncedAt: syncedAt,
        deletedAt: null,
        isDeleted: false,
        wordFilter: null,
        dupliFilter: null,
        moderationFilter: null,
        multipleMessageFilter: null,
        isFiltered: false,
        isMeasured: false,
        measuredMessage: null,
    };
}
