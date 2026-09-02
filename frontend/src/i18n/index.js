import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import ja from './locales/ja.json';

const LOCALE_STORAGE_KEY = 'locale';
const SUPPORTED_LOCALES = ['ja', 'en'];

function resolveInitialLocale() {
    if (typeof window === 'undefined') {
        return 'ja';
    }

    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved)) {
        return saved;
    }

    const browserLocale = window.navigator.language.toLowerCase();
    if (browserLocale.startsWith('ja')) {
        return 'ja';
    }

    return 'en';
}

export const i18n = createI18n({
    legacy: false,
    locale: resolveInitialLocale(),
    fallbackLocale: 'en',
    messages: {
        ja,
        en
    }
});

export const localeOptions = [
    { label: '日本語', value: 'ja' },
    { label: 'English', value: 'en' }
];

export function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) {
        return;
    }

    i18n.global.locale.value = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function getLocale() {
    return i18n.global.locale.value;
}
