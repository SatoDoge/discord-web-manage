<script setup>
import OnlineMemberWidget from '@/components/dashboard/OnlineMemberWidget.vue';
import StatsWidget from '@/components/dashboard/StatsWidget.vue';
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <StatsWidget />
        <OnlineMemberWidget />
    </div>
</template>
