<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
</script>

<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Login</div>
                        <span class="text-muted-color font-medium">Login to continue</span>
                    </div>

                    <Button label="Login With Discord" class="discord-btn w-full" as="a" href="/api/auth/discord"></Button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.discord-btn {
    background-color: #5865f2;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    text-decoration: none;
    font-weight: bold;
}
.discord-btn:hover {
    background-color: #4752c4;
}
</style>
