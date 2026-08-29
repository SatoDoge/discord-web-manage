import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useDiscordPresence() {
    const { t } = useI18n();

    const presenceStatusOptions = computed(() => [
        { label: t('bot.presence.statusOnline'), value: 'online', dotClass: 'status-dot--online' },
        { label: t('bot.presence.statusIdle'), value: 'idle', dotClass: 'status-dot--idle' },
        { label: t('bot.presence.statusDnd'), value: 'dnd', dotClass: 'status-dot--dnd' },
        { label: t('bot.presence.statusInvisible'), value: 'invisible', dotClass: 'status-dot--offline' }
    ]);

    const activityTypeOptions = computed(() => [
        { label: t('bot.presence.activityPlaying'), value: 0 },
        { label: t('bot.presence.activityStreaming'), value: 1 },
        { label: t('bot.presence.activityListening'), value: 2 },
        { label: t('bot.presence.activityWatching'), value: 3 },
        { label: t('bot.presence.activityCustom'), value: 4 },
        { label: t('bot.presence.activityCompeting'), value: 5 }
    ]);

    const activityLabels = computed(() => ({
        0: t('bot.presence.activityPlaying'),
        1: t('bot.presence.activityStreaming'),
        2: t('bot.presence.activityListening'),
        3: t('bot.presence.activityWatching'),
        4: t('bot.presence.activityCustom'),
        5: t('bot.presence.activityCompeting')
    }));

    function formatPresenceStatus(status) {
        return presenceStatusOptions.value.find((option) => option.value === status)?.label ?? status;
    }

    function formatDiscordActivity(activity) {
        if (!activity) {
            return t('bot.presence.noActivity');
        }

        if (activity.type === 4) {
            return activity.state ?? activity.name ?? t('bot.presence.noActivity');
        }

        const prefix = activityLabels.value[activity.type] ?? t('bot.presence.activity');
        return `${prefix} ${activity.name}`;
    }

    return {
        presenceStatusOptions,
        activityTypeOptions,
        formatPresenceStatus,
        formatDiscordActivity
    };
}
