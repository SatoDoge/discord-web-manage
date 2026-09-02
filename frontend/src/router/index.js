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
                    path: '/bot/activity',
                    redirect: '/manage/activity'
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
                    path: '/manage/message-send',
                    name: 'messageSend',
                    component: () => import('@/views/pages/manage/MessageSend.vue')
                },
                {
                    path: '/manage/bot-messages',
                    name: 'botPostedMessages',
                    component: () => import('@/views/pages/manage/BotPostedMessages.vue')
                },
                {
                    path: '/manage/activity',
                    name: 'botActivity',
                    component: () => import('@/views/pages/manage/Activity.vue')
                },
                {
                    path: '/filter',
                    redirect: '/filter/messages'
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
                },
                {
                    path: '/filter/member',
                    redirect: '/filter/member/joins'
                },
                {
                    path: '/filter/member/joins',
                    name: 'memberJoinDb',
                    component: () => import('@/views/pages/filter/MemberJoinDb.vue')
                },
                {
                    path: '/filter/member/name',
                    name: 'memberNameFilter',
                    component: () => import('@/views/pages/filter/MemberNameFilter.vue')
                },
                {
                    path: '/filter/member/join-delay',
                    name: 'memberJoinDelayFilter',
                    component: () => import('@/views/pages/filter/MemberJoinDelayFilter.vue')
                },
                {
                    path: '/filter/member/profile-moderation',
                    name: 'memberProfileModerationFilter',
                    component: () => import('@/views/pages/filter/MemberProfileModerationFilter.vue')
                },
                {
                    path: '/setting/admin-users',
                    name: 'adminUsers',
                    component: () => import('@/views/pages/setting/AdminUser.vue')
                },
                {
                    path: '/setting/operation-logs',
                    name: 'operationLogs',
                    component: () => import('@/views/pages/setting/OperationLog.vue')
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
