<script setup>
import { ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

const model = ref([
    {
        label: 'Home',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-home',
                to: '/'
            }
        ]
    },
    {
        label: 'Bot',
        items: [
            {
                label: 'Status',
                icon: 'pi pi-fw pi-discord',
                to: '/bot/status'
            },
            {
                label: 'Activity',
                icon: 'pi pi-fw pi-sliders-h',
                to: '/bot/activity'
            }
        ]
    },
    {
        label: 'Manage',
        items: [
            {
                label: 'Users',
                icon: 'pi pi-fw pi-users',
                to: '/manage/users'
            },
            {
                label: 'Messages',
                icon: 'pi pi-fw pi-comments',
                to: '/manage/messages'
            }
        ]
    },
    {
        label: 'Filter',
        items: [
            {
                label: 'Word Filter',
                icon: 'pi pi-fw pi-ban',
                to: '/filter/word'
            },
            {
                label: 'Duplicate Filter',
                icon: 'pi pi-fw pi-clone',
                to: '/filter/dupli'
            },
            {
                label: 'Moderation Filter',
                icon: 'pi pi-fw pi-shield',
                to: '/filter/moderation'
            },
            {
                label: 'Message DB',
                icon: 'pi pi-fw pi-database',
                to: '/filter/messages'
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
