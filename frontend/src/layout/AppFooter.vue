<script setup>
import { onMounted, ref } from 'vue';

const version = ref('');

onMounted(async () => {
    try {
        const response = await fetch('/api/version');
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (typeof data === 'string' && data) {
            version.value = data;
        }
    } catch {
        // Keep footer empty when version is unavailable.
    }
});
</script>

<template>
    <div class="layout-footer">
        <span v-if="version" class="text-muted-color text-sm">v{{ version }}</span>
    </div>
</template>
