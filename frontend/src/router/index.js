import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/bot/status',
                    name: 'status',
                    component: () => import('@/views/pages/bot/Status.vue')
                },
                {
                    path: '/bot/activity',
                    name: 'botActivity',
                    component: () => import('@/views/pages/bot/Activity.vue')
                },
                {
                    path: '/manage/users',
                    name: 'userList',
                    component: () => import('@/views/pages/manage/UserList.vue')
                },
                {
                    path: '/manage/messages',
                    name: 'messageList',
                    component: () => import('@/views/pages/manage/MessageList.vue')
                },
                {
                    path: '/filter/word',
                    name: 'wordFilter',
                    component: () => import('@/views/pages/filter/WordFilter.vue')
                },
                {
                    path: '/filter/dupli',
                    name: 'dupliFilter',
                    component: () => import('@/views/pages/filter/DupliFilter.vue')
                },
                {
                    path: '/filter/moderation',
                    name: 'moderationFilter',
                    component: () => import('@/views/pages/filter/ModerationFilter.vue')
                },
                {
                    path: '/filter/messages',
                    name: 'messageDb',
                    component: () => import('@/views/pages/filter/MessageDb.vue')
                }
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/redirect',
            name: 'authRedirect',
            component: () => import('@/views/pages/auth/Redirect.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        }
    ]
});

export default router;
