<script setup>
import { CHANNEL_LIST_TYPE_OPTIONS, DELETE_MESSAGE_SECONDS_OPTIONS } from '@/utils/filterDefaults';
import { watch } from 'vue';

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
            <div class="font-semibold text-lg mb-1">General</div>
            <p class="text-muted-color m-0 text-sm">Enable the filter and choose which channels it applies to.</p>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox v-model="form.isEnabled" inputId="filter-enabled" binary :disabled="disabled" />
            <label for="filter-enabled">Enable this filter</label>
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-channels">Target channels</label>
            <MultiSelect
                id="filter-channels"
                v-model="form.channelIdList"
                :options="channelOptions"
                optionLabel="label"
                optionValue="value"
                display="chip"
                placeholder="Select channels"
                class="w-full"
                :disabled="disabled"
                filter
            />
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-channel-list-type">Channel list mode</label>
            <Select
                id="filter-channel-list-type"
                v-model="form.channelListType"
                :options="CHANNEL_LIST_TYPE_OPTIONS"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                :disabled="disabled"
            />
        </div>

        <div class="flex flex-col gap-2">
            <label for="filter-notification-channel">Notification channel</label>
            <Select
                id="filter-notification-channel"
                v-model="form.notificationChannelId"
                :options="notificationChannelOptions"
                optionLabel="label"
                optionValue="value"
                showClear
                placeholder="Select a channel"
                class="w-full"
                :disabled="disabled"
            />
        </div>

        <Divider />

        <div>
            <div class="font-semibold text-lg mb-1">Automatic measures</div>
            <p class="text-muted-color m-0 text-sm">
                Actions applied when a message fails this filter. Lighter measures run first; ban takes priority over kick.
            </p>
        </div>

        <div class="flex items-center gap-3">
            <Checkbox v-model="form.deleteMessage" inputId="filter-delete-message" binary :disabled="disabled" />
            <label for="filter-delete-message">Delete message</label>
        </div>

        <div class="flex flex-col gap-3 rounded-border border border-surface p-4">
            <div class="flex items-center gap-3">
                <Checkbox v-model="form.giveRole" inputId="filter-give-role" binary :disabled="disabled" />
                <label for="filter-give-role">Give role</label>
            </div>
            <div v-if="form.giveRole" class="flex flex-col gap-2">
                <label for="filter-role-id">Role</label>
                <Select
                    id="filter-role-id"
                    v-model="form.roleId"
                    :options="roleOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select a role"
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
                <label for="filter-kick-user">Kick user</label>
            </div>
            <Message v-if="form.banUser" severity="info" :closable="false">
                Kick is ignored when ban is enabled.
            </Message>
            <template v-if="form.kickUser && !form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="filter-kick-reason">Kick reason</label>
                    <Textarea
                        id="filter-kick-reason"
                        v-model="form.kickReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        placeholder="Reason shown in the audit log"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="filter-kick-seconds">Kick seconds</label>
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
                <label for="filter-ban-user">Ban user</label>
            </div>
            <template v-if="form.banUser">
                <div class="flex flex-col gap-2">
                    <label for="filter-ban-reason">Ban reason</label>
                    <Textarea
                        id="filter-ban-reason"
                        v-model="form.banReason"
                        rows="3"
                        class="w-full"
                        :disabled="disabled"
                        placeholder="Reason shown in the audit log"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="filter-delete-message-seconds">Delete recent messages on ban</label>
                    <Select
                        id="filter-delete-message-seconds"
                        v-model="form.deleteMessageSeconds"
                        :options="DELETE_MESSAGE_SECONDS_OPTIONS"
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
