<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const message = ref('Signing you in…');

onMounted(async () => {
    const code = route.query.code;
    if (typeof code !== 'string' || !code) {
        message.value = 'Login failed: missing authorization code.';
        await router.replace('/auth/error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code })
        });

        if (response.status === 403) {
            await router.replace('/auth/access');
            return;
        }

        if (!response.ok) {
            await router.replace('/auth/error');
            return;
        }

        await router.replace('/');
    } catch {
        message.value = 'Login failed.';
        await router.replace('/auth/error');
    }
});
</script>

<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="text-surface-900 dark:text-surface-0 text-xl font-medium">{{ message }}</div>
    </div>
</template>
