<script setup>
import { useFilterOptions } from '@/composables/useFilterOptions';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { channelListTypeOptions, deleteMessageSecondsOptions } = useFilterOptions();

const props = defineProps({
    form: {
        type: Object,
        required: true
    },
    channelOptions: {
        type: Array,
        default: () => []
    },
    notificationChannelOptions: {
        type: Array,
        default: () => []
    },
    roleOptions: {
        type: Array,
        default: () => []
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

watch(
    () => props.form.banUser,
    (enabled) => {
        if (enabled && props.form.deleteMessageSeconds == null) {
            props.form.deleteMessageSeconds = 0;
        }
    }
);
</script>

<template>
    <div class="flex flex-col gap-6">
        <div>
            <div class="font-semibold text-lg mb-1">{{ t('filter.common.general') }}</div>
            <p class="text-muted-color m-0 text-sm">{{ t('filter.common.generalDescription') }}</p>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox v-model="form.isEnabled" inputId="filter-enabled" binary :disabled="disabled" />
            <label for="filter-enabled">{{ t('filter.common.enabled') }}</label>
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-channels">{{ t('filter.common.targetChannels') }}</label>
            <MultiSelect
                id="filter-channels"
                v-model="form.channelIdList"
                :options="channelOptions"
                optionLabel="label"
                optionValue="value"
                display="chip"
                :placeholder="t('filter.common.selectChannels')"
                class="w-full"
                :disabled="disabled"
                filter
            />
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-channel-list-type">{{ t('filter.common.channelListMode') }}</label>
            <Select
                id="filter-channel-list-type"
                v-model="form.channelListType"
                :options="channelListTypeOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                :disabled="disabled"
            />
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-notification-channel">{{ t('filter.common.notificationChannel') }}</label>
            <Select
                id="filter-notification-channel"
                v-model="form.notificationChannelId"
                :options="notificationChannelOptions"
                optionLabel="label"
                optionValue="value"
                showClear
                :placeholder="t('filter.common.selectChannel')"
                class="w-full"
                :disabled="disabled"
            />
        </div>

        <Divider />

        <div>
            <div class="font-semibold text-lg mb-1">{{ t('filter.common.automaticMeasures') }}</div>
            <p class="text-muted-color m-0 text-sm">
                {{ t('filter.common.automaticMeasuresDescription') }}
            </p>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox v-model="form.deleteMessage" inputId="filter-delete-message" binary :disabled="disabled" />
            <label for="filter-delete-message">{{ t('filter.common.deleteMessage') }}</label>
        </div>

        <div class="flex flex-col gap-3 rounded-border border border-surface p-4">
            <div class="flex items-center gap-3">
                <Checkbox v-model="form.giveRole" inputId="filter-give-role" binary :disabled="disabled" />
                <label for="filter-give-role">{{ t('filter.common.giveRole') }}</label>
            </div>
            <div v-if="form.giveRole" class="flex flex-col gap-2">
                <label for="filter-role-id">{{ t('filter.common.role') }}</label>
                <Select
                    id="filter-role-id"
                    v-model="form.roleId"
                    :options="roleOptions"
                    optionLabel="label"
                    optionValue="value"
                    :placeholder="t('filter.common.selectRole')"
                    class="w-full"
                    :disabled="disabled"
                    filter
                >
                    <template #option="slotProps">
                        <div class="flex items-center gap-2">
                            <span
                                class="role-swatch"
                                :style="{ backgroundColor: slotProps.option.hexColor || 'var(--surface-400)' }"
                            ></span>
                            <span>{{ slotProps.option.label }}</span>
                        </div>
                    </template>
                </Select>
            </div>
        </div>

        <div class="flex flex-col gap-3 rounded-border border border-surface p-4">
            <div class="flex items-center gap-3">
                <Checkbox
                    v-model="form.kickUser"
                    inputId="filter-kick-user"
                    binary
                    :disabled="disabled || form.banUser"
                />
                <label for="filter-kick-user">{{ t('filter.common.kickUser') }}</label>
            </div>
            <Message v-if="form.banUser" severity="info" :closable="false">
                {{ t('filter.common.kickIgnoredByBan') }}
            </Message>
            <template v-if="form.kickUser && !form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="filter-kick-reason">{{ t('filter.common.kickReason') }}</label>
                    <Textarea
                        id="filter-kick-reason"
                        v-model="form.kickReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        :placeholder="t('filter.common.kickReasonPlaceholder')"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="filter-kick-seconds">{{ t('filter.common.kickSeconds') }}</label>
                    <InputNumber
                        id="filter-kick-seconds"
                        v-model="form.kickSeconds"
                        class="w-full"
                        :disabled="disabled"
                        :min="0"
                        showButtons
                    />
                </div>
            </template>
        </div>

        <div class="flex flex-col gap-3 rounded-border border border-surface p-4">
            <div class="flex items-center gap-3">
                <Checkbox v-model="form.banUser" inputId="filter-ban-user" binary :disabled="disabled" />
                <label for="filter-ban-user">{{ t('filter.common.banUser') }}</label>
            </div>
            <template v-if="form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="filter-ban-reason">{{ t('filter.common.banReason') }}</label>
                    <Textarea
                        id="filter-ban-reason"
                        v-model="form.banReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        :placeholder="t('filter.common.banReasonPlaceholder')"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="filter-delete-message-seconds">{{ t('filter.common.deleteRecentOnBan') }}</label>
                    <Select
                        id="filter-delete-message-seconds"
                        v-model="form.deleteMessageSeconds"
                        :options="deleteMessageSecondsOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        :disabled="disabled"
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.role-swatch {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    flex-shrink: 0;
}
</style>
