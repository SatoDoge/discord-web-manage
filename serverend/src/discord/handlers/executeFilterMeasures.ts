import { banGuildMember } from "#server/discord/banMember.js";
import { deleteGuildMessage } from "#server/discord/deleteMessage.js";
import { giveRoleToMember } from "#server/discord/giveRoleMember.js";
import { kickGuildMember } from "#server/discord/kickMember.js";
import { getDiscordClient } from "#server/discord.js";
import {
    createMeasuredEntry,
    emptyMeasuredDetail,
} from "#server/services/message/measuredMessageRecord.js";
import type { MeasuredMessage, StoredGuildMessage } from "#server/types/messageData.js";
import type { Settings } from "#server/types/messageFilterSettings.js";
import { Logger } from "#server/utils/logger.js";

const logger = new Logger("discord.handlers.executeFilterMeasures");

type BanMeasure = {
    reason: string;
    deleteMessageSeconds: number;
};

type KickMeasure = {
    reason: string;
    kickSeconds: number;
};

type PlannedMeasures = {
    deleteMessage: boolean;
    roleIds: string[];
    ban: BanMeasure | null;
    kick: KickMeasure | null;
};

function mergeReasons(existing: string, next: string): string {
    const parts = [existing, next]
        .map((value) => value.trim())
        .filter(Boolean);
    return [...new Set(parts)].join("; ");
}

function mergeBanMeasure(current: BanMeasure | null, settings: Settings): BanMeasure {
    const reason = settings.banReason?.trim() ?? "";
    const deleteMessageSeconds = settings.deleteMessageSeconds ?? 0;

    if (!current) {
        return { reason, deleteMessageSeconds };
    }

    return {
        reason: mergeReasons(current.reason, reason),
        deleteMessageSeconds: Math.max(current.deleteMessageSeconds, deleteMessageSeconds),
    };
}

function mergeKickMeasure(current: KickMeasure | null, settings: Settings): KickMeasure {
    const reason = settings.kickReason?.trim() ?? "";
    const kickSeconds = settings.kickSeconds ?? 0;

    if (!current) {
        return { reason, kickSeconds };
    }

    return {
        reason: mergeReasons(current.reason, reason),
        kickSeconds: Math.max(current.kickSeconds, kickSeconds),
    };
}

export function collectPlannedMeasures(settingsList: Settings[]): PlannedMeasures {
    let deleteMessage = false;
    const roleIds = new Set<string>();
    let ban: BanMeasure | null = null;
    let kick: KickMeasure | null = null;
    let hasBan = false;
    let hasKick = false;

    for (const settings of settingsList) {
        if (settings.deleteMessage) {
            deleteMessage = true;
        }

        if (settings.giveRole && settings.roleId) {
            roleIds.add(settings.roleId);
        }

        if (settings.banUser) {
            hasBan = true;
            ban = mergeBanMeasure(ban, settings);
        }

        if (settings.kickUser) {
            hasKick = true;
            kick = mergeKickMeasure(kick, settings);
        }
    }

    if (hasBan) {
        return {
            deleteMessage,
            roleIds: [...roleIds],
            ban,
            kick: null,
        };
    }

    return {
        deleteMessage,
        roleIds: [...roleIds],
        ban: null,
        kick: hasKick ? kick : null,
    };
}

function hasPlannedMeasures(measures: PlannedMeasures): boolean {
    return (
        measures.deleteMessage ||
        measures.roleIds.length > 0 ||
        measures.ban !== null ||
        measures.kick !== null
    );
}

export async function executeFilterMeasures(
    stored: StoredGuildMessage,
    triggeredSettings: Settings[],
): Promise<void> {
    const measures = collectPlannedMeasures(triggeredSettings);

    stored.isFiltered = triggeredSettings.length > 0;

    if (!hasPlannedMeasures(measures)) {
        stored.isMeasured = false;
        stored.measuredMessage = null;
        return;
    }

    const client = getDiscordClient();
    const operationUserId = client?.user?.id ?? "unknown";
    const measuredMessage: MeasuredMessage[] = [];

    if (measures.deleteMessage) {
        const result = await deleteGuildMessage(stored.channelId, stored.messageId);
        const isDeleted = result.ok;

        if (!result.ok) {
            logger.error(
                `Failed to delete message ${stored.messageId}: ${result.error}`,
            );
        }

        measuredMessage.push(
            createMeasuredEntry(operationUserId, {
                command: "delete",
                ...emptyMeasuredDetail(),
                deleteDetail: { isDeleted },
            }),
        );

        if (isDeleted) {
            stored.isDeleted = true;
            stored.deletedAt = new Date().toISOString();
        }
    }

    for (const roleId of measures.roleIds) {
        try {
            await giveRoleToMember(stored.guildId, stored.author.userId, roleId);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "role",
                    ...emptyMeasuredDetail(),
                    roleDetail: { roleId },
                }),
            );
        } catch (error) {
            logger.error(
                `Failed to give role ${roleId} to ${stored.author.userId}: ${String(error)}`,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "none",
                    ...emptyMeasuredDetail(),
                    roleDetail: { roleId },
                }),
            );
        }
    }

    if (measures.ban) {
        try {
            await banGuildMember(
                stored.guildId,
                stored.author.userId,
                measures.ban.reason,
                measures.ban.deleteMessageSeconds,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "ban",
                    ...emptyMeasuredDetail(),
                    banDetail: {
                        reason: measures.ban.reason,
                        deleteMessageSeconds: measures.ban.deleteMessageSeconds,
                    },
                }),
            );
        } catch (error) {
            logger.error(`Failed to ban ${stored.author.userId}: ${String(error)}`);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "none",
                    ...emptyMeasuredDetail(),
                    banDetail: {
                        reason: measures.ban.reason,
                        deleteMessageSeconds: measures.ban.deleteMessageSeconds,
                    },
                }),
            );
        }
    } else if (measures.kick) {
        try {
            await kickGuildMember(
                stored.guildId,
                stored.author.userId,
                measures.kick.reason,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "kick",
                    ...emptyMeasuredDetail(),
                    kickDetail: {
                        reason: measures.kick.reason,
                        kickSeconds: measures.kick.kickSeconds,
                    },
                }),
            );
        } catch (error) {
            logger.error(`Failed to kick ${stored.author.userId}: ${String(error)}`);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: "none",
                    ...emptyMeasuredDetail(),
                    kickDetail: {
                        reason: measures.kick.reason,
                        kickSeconds: measures.kick.kickSeconds,
                    },
                }),
            );
        }
    }

    stored.isMeasured = measuredMessage.length > 0;
    stored.measuredMessage = measuredMessage.length > 0 ? measuredMessage : null;
}
