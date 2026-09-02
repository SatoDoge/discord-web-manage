import { banGuildMember } from '#server/discord/banMember.js';
import { giveRoleToMember } from '#server/discord/giveRoleMember.js';
import { kickGuildMember } from '#server/discord/kickMember.js';
import { getDiscordClient } from '#server/discord.js';
import {
    createMeasuredEntry,
    emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import type { MeasuredMessage } from '#server/types/messageData.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import type { Settings } from '#server/types/memberFilterSettings.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord.handlers.executeMemberFilterMeasures');

type BanMeasure = {
    reason: string;
};

type KickMeasure = {
    reason: string;
    kickSeconds: number;
};

type PlannedMeasures = {
    roleIds: string[];
    ban: BanMeasure | null;
    kick: KickMeasure | null;
};

function mergeReasons(existing: string, next: string): string {
    const parts = [existing, next]
        .map((value) => value.trim())
        .filter(Boolean);
    return [...new Set(parts)].join('; ');
}

function mergeBanMeasure(current: BanMeasure | null, settings: Settings): BanMeasure {
    const reason = settings.banReason?.trim() ?? '';

    if (!current) {
        return { reason };
    }

    return {
        reason: mergeReasons(current.reason, reason),
    };
}

function mergeKickMeasure(current: KickMeasure | null, settings: Settings): KickMeasure {
    const reason = settings.kickReason?.trim() ?? '';
    const kickSeconds = settings.kickSeconds ?? 0;

    if (!current) {
        return { reason, kickSeconds };
    }

    return {
        reason: mergeReasons(current.reason, reason),
        kickSeconds: Math.max(current.kickSeconds, kickSeconds),
    };
}

export function collectPlannedMemberMeasures(settingsList: Settings[]): PlannedMeasures {
    const roleIds = new Set<string>();
    let ban: BanMeasure | null = null;
    let kick: KickMeasure | null = null;
    let hasBan = false;
    let hasKick = false;

    for (const settings of settingsList) {
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
            roleIds: [...roleIds],
            ban,
            kick: null,
        };
    }

    return {
        roleIds: [...roleIds],
        ban: null,
        kick: hasKick ? kick : null,
    };
}

function hasPlannedMeasures(measures: PlannedMeasures): boolean {
    return (
        measures.roleIds.length > 0 ||
        measures.ban !== null ||
        measures.kick !== null
    );
}

export async function executeMemberFilterMeasures(
    stored: StoredMemberJoinEvent,
    triggeredSettings: Settings[],
): Promise<void> {
    const measures = collectPlannedMemberMeasures(triggeredSettings);

    stored.isFiltered = triggeredSettings.length > 0;

    if (!hasPlannedMeasures(measures)) {
        stored.isMeasured = false;
        stored.measuredMessage = null;
        return;
    }

    const client = getDiscordClient();
    const operationUserId = client?.user?.id ?? 'unknown';
    const measuredMessage: MeasuredMessage[] = [];

    for (const roleId of measures.roleIds) {
        try {
            await giveRoleToMember(stored.guildId, stored.userId, roleId);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'role',
                    ...emptyMeasuredDetail(),
                    roleDetail: { roleId },
                }),
            );
        } catch (error) {
            logger.error(
                `Failed to give role ${roleId} to ${stored.userId}: ${String(error)}`,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'none',
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
                stored.userId,
                measures.ban.reason,
                0,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'ban',
                    ...emptyMeasuredDetail(),
                    banDetail: {
                        reason: measures.ban.reason,
                        deleteMessageSeconds: 0,
                    },
                }),
            );
        } catch (error) {
            logger.error(`Failed to ban ${stored.userId}: ${String(error)}`);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'none',
                    ...emptyMeasuredDetail(),
                    banDetail: {
                        reason: measures.ban.reason,
                        deleteMessageSeconds: 0,
                    },
                }),
            );
        }
    } else if (measures.kick) {
        try {
            await kickGuildMember(
                stored.guildId,
                stored.userId,
                measures.kick.reason,
            );
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'kick',
                    ...emptyMeasuredDetail(),
                    kickDetail: {
                        reason: measures.kick.reason,
                        kickSeconds: measures.kick.kickSeconds,
                    },
                }),
            );
        } catch (error) {
            logger.error(`Failed to kick ${stored.userId}: ${String(error)}`);
            measuredMessage.push(
                createMeasuredEntry(operationUserId, {
                    command: 'none',
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
