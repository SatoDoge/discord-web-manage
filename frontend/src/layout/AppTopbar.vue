<script setup>
import { useLayout } from '@/layout/composables/layout';
import { getLocale, localeOptions, setLocale } from '@/i18n';
import AppConfigurator from './AppConfigurator.vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();
const router = useRouter();
const { t } = useI18n();

/** @type {import('vue').Ref<{ id: string, username: string, displayName: string, icon: string } | null>} */
const currentUser = ref(null);
const selectedLocale = ref(getLocale());

function onLocaleChange(locale) {
    setLocale(locale);
    selectedLocale.value = locale;
}

onMounted(async () => {
    try {
        const response = await fetch('/api/user/state', { credentials: 'include' });
        if (response.status === 401) {
            await router.replace('/auth/login');
            return;
        }
        if (!response.ok) {
            return;
        }
        currentUser.value = await response.json();
    } catch {
        await router.replace('/auth/login');
    }
});
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <span>SAKAI</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <div class="locale-select hidden md:block">
                    <Select
                        v-model="selectedLocale"
                        :options="localeOptions"
                        optionLabel="label"
                        optionValue="value"
                        :aria-label="t('topbar.language')"
                        class="locale-select-input"
                        @update:model-value="onLocaleChange"
                    />
                </div>
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div class="relative">
                    <button
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
                        type="button"
                        class="layout-topbar-action layout-topbar-action-highlight"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <div class="locale-select-mobile md:hidden">
                        <Select
                            v-model="selectedLocale"
                            :options="localeOptions"
                            optionLabel="label"
                            optionValue="value"
                            :aria-label="t('topbar.language')"
                            class="locale-select-input"
                            @update:model-value="onLocaleChange"
                        />
                    </div>
                    <button type="button" class="layout-topbar-action">
                        <i class="pi pi-inbox"></i>
                        <span>{{ t('topbar.messages') }}</span>
                    </button>
                    <button type="button" class="layout-topbar-action profile-action" :class="{ 'is-authenticated': !!currentUser }">
                        <img v-if="currentUser?.icon" class="profile-avatar" :src="currentUser.icon" :alt="currentUser.displayName" />
                        <i v-else class="pi pi-user"></i>
                        <span>{{ currentUser?.displayName ?? t('topbar.profile') }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.profile-action.is-authenticated {
    width: auto;
    min-width: 2.5rem;
    border-radius: 999px;
    padding: 0 0.75rem 0 0.25rem;
    gap: 0.5rem;
}

.profile-action.is-authenticated span {
    display: inline;
    white-space: nowrap;
}

.profile-avatar {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    object-fit: cover;
}

.locale-select {
    display: flex;
    align-items: center;
}

.locale-select-input {
    min-width: 7.5rem;
}

.locale-select-mobile {
    padding: 0.5rem 0.75rem;
}

.locale-select-mobile .locale-select-input {
    width: 100%;
}
</style>
