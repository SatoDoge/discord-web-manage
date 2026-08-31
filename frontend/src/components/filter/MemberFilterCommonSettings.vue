<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
    form: {
        type: Object,
        required: true
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
</script>

<template>
    <div class="flex flex-col gap-6">
        <div>
            <div class="font-semibold text-lg mb-1">{{ t('filter.memberCommon.general') }}</div>
            <p class="text-muted-color m-0 text-sm">{{ t('filter.memberCommon.generalDescription') }}</p>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox v-model="form.isEnabled" inputId="member-filter-enabled" binary :disabled="disabled" />
            <label for="member-filter-enabled">{{ t('filter.common.enabled') }}</label>
        </div>

        <div class="flex flex-col gap-2">
            <label for="member-filter-notification-channel">{{ t('filter.common.notificationChannel') }}</label>
            <Select
                id="member-filter-notification-channel"
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
                {{ t('filter.memberCommon.automaticMeasuresDescription') }}
            </p>
        </div>

        <div class="flex flex-col gap-3 rounded-border border border-surface p-4">
            <div class="flex items-center gap-3">
                <Checkbox v-model="form.giveRole" inputId="member-filter-give-role" binary :disabled="disabled" />
                <label for="member-filter-give-role">{{ t('filter.common.giveRole') }}</label>
            </div>
            <div v-if="form.giveRole" class="flex flex-col gap-2">
                <label for="member-filter-role-id">{{ t('filter.common.role') }}</label>
                <Select
                    id="member-filter-role-id"
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
                    inputId="member-filter-kick-user"
                    binary
                    :disabled="disabled || form.banUser"
                />
                <label for="member-filter-kick-user">{{ t('filter.common.kickUser') }}</label>
            </div>
            <Message v-if="form.banUser" severity="info" :closable="false">
                {{ t('filter.common.kickIgnoredByBan') }}
            </Message>
            <template v-if="form.kickUser && !form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="member-filter-kick-reason">{{ t('filter.common.kickReason') }}</label>
                    <Textarea
                        id="member-filter-kick-reason"
                        v-model="form.kickReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        :placeholder="t('filter.common.kickReasonPlaceholder')"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="member-filter-kick-seconds">{{ t('filter.common.kickSeconds') }}</label>
                    <InputNumber
                        id="member-filter-kick-seconds"
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
                <Checkbox v-model="form.banUser" inputId="member-filter-ban-user" binary :disabled="disabled" />
                <label for="member-filter-ban-user">{{ t('filter.common.banUser') }}</label>
            </div>
            <template v-if="form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="member-filter-ban-reason">{{ t('filter.common.banReason') }}</label>
                    <Textarea
                        id="member-filter-ban-reason"
                        v-model="form.banReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        :placeholder="t('filter.common.banReasonPlaceholder')"
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
