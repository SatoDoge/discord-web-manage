import { computed, ref } from 'vue';

export function useDiscordOptions() {
    const loading = ref(false);
    const members = ref([]);
    const channels = ref([]);

    const channelOptions = computed(() =>
        channels.value.map((channel) => ({
            label: channel.nsfw ? `#${channel.name} (NSFW)` : `#${channel.name}`,
            value: channel.id
        }))
    );

    const notificationChannelOptions = computed(() => [
        { label: 'None', value: null },
        ...channelOptions.value
    ]);

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

    const memberNameById = computed(() => {
        const map = new Map();
        for (const member of members.value) {
            map.set(member.id, member.displayName || member.username || member.id);
        }
        return map;
    });

    const channelNameById = computed(() => {
        const map = new Map();
        for (const channel of channels.value) {
            map.set(channel.id, channel.name);
        }
        return map;
    });

    async function loadDiscordOptions() {
        loading.value = true;
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
                throw new Error('failed_to_load');
            }
        } finally {
            loading.value = false;
        }
    }

    return {
        loading,
        members,
        channels,
        channelOptions,
        notificationChannelOptions,
        roleOptions,
        memberNameById,
        channelNameById,
        loadDiscordOptions
    };
}
