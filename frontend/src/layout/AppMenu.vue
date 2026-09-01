<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppMenuItem from './AppMenuItem.vue';

const { t } = useI18n();

const model = computed(() => [
    {
        label: t('menu.home'),
        items: [
            {
                label: t('menu.dashboard'),
                icon: 'pi pi-fw pi-home',
                to: '/'
            }
        ]
    },
    {
        label: t('menu.bot'),
        items: [
            {
                label: t('menu.status'),
                icon: 'pi pi-fw pi-discord',
                to: '/bot/status'
            }
        ]
    },
    {
        label: t('menu.manage'),
        items: [
            {
                label: t('menu.activity'),
                icon: 'pi pi-fw pi-sliders-h',
                to: '/manage/activity'
            },
            {
                label: t('menu.users'),
                icon: 'pi pi-fw pi-users',
                to: '/manage/users'
            },
            {
                label: t('menu.messages'),
                icon: 'pi pi-fw pi-comments',
                to: '/manage/messages'
            },
            {
                label: t('menu.messageSend'),
                icon: 'pi pi-fw pi-send',
                to: '/manage/message-send'
            },
            {
                label: t('menu.botPostedMessages'),
                icon: 'pi pi-fw pi-inbox',
                to: '/manage/bot-messages'
            }
        ]
    },
    {
        label: t('menu.filter'),
        items: [
            {
                label: t('menu.messageFilter'),
                icon: 'pi pi-fw pi-filter',
                path: '/filter',
                items: [
                    {
                        label: t('menu.messageDb'),
                        icon: 'pi pi-fw pi-database',
                        to: '/filter/messages'
                    },
                    {
                        label: t('menu.wordFilter'),
                        icon: 'pi pi-fw pi-ban',
                        to: '/filter/word'
                    },
                    {
                        label: t('menu.dupliFilter'),
                        icon: 'pi pi-fw pi-clone',
                        to: '/filter/dupli'
                    },
                    {
                        label: t('menu.moderationFilter'),
                        icon: 'pi pi-fw pi-shield',
                        to: '/filter/moderation'
                    }
                ]
            },
            {
                label: t('menu.memberFilter'),
                icon: 'pi pi-fw pi-user-plus',
                path: '/filter/member',
                items: [
                    {
                        label: t('menu.memberJoinDb'),
                        icon: 'pi pi-fw pi-database',
                        to: '/filter/member/joins'
                    },
                    {
                        label: t('menu.memberNameFilter'),
                        icon: 'pi pi-fw pi-ban',
                        to: '/filter/member/name'
                    },
                    {
                        label: t('menu.memberJoinDelayFilter'),
                        icon: 'pi pi-fw pi-clock',
                        to: '/filter/member/join-delay'
                    },
                    {
                        label: t('menu.memberProfileModerationFilter'),
                        icon: 'pi pi-fw pi-shield',
                        to: '/filter/member/profile-moderation'
                    }
                ]
            }
        ]
    },
    {
        label: t('menu.settings'),
        items: [
            {
                label: t('menu.adminUsers'),
                icon: 'pi pi-fw pi-user-edit',
                to: '/setting/admin-users'
            },
            {
                label: t('menu.operationLogs'),
                icon: 'pi pi-fw pi-history',
                to: '/setting/operation-logs'
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item.label">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
