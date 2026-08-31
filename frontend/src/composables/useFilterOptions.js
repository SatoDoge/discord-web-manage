import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MODERATION_CATEGORIES } from '@/utils/filterDefaults';

export function useFilterOptions() {
    const { t } = useI18n();

    const channelListTypeOptions = computed(() => [
        { label: t('filter.common.channelAllow'), value: 'allow' },
        { label: t('filter.common.channelBlock'), value: 'block' }
    ]);

    const deleteMessageSecondsOptions = computed(() => [
        { label: t('filter.common.deleteMessageNone'), value: 0 },
        { label: t('filter.common.deleteMessage24h'), value: 24 * 60 * 60 },
        { label: t('filter.common.deleteMessage7d'), value: 7 * 24 * 60 * 60 }
    ]);

    const moderationCategoryOptions = computed(() =>
        MODERATION_CATEGORIES.map((category) => ({
            ...category,
            label: t(`filter.moderation.categories.${category.i18nKey}`)
        }))
    );

    return {
        channelListTypeOptions,
        deleteMessageSecondsOptions,
        moderationCategoryOptions
    };
}
