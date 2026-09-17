<template>
    <div id="app" class="min-h-screen w-full flex items-center justify-center p-4 md:p-8 app-bg">
        <router-view />
    </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.app-bg {
    background:
        radial-gradient(ellipse 90% 60% at 12% -10%, rgba(197, 161, 107, 0.14), transparent),
        radial-gradient(ellipse 70% 55% at 95% 8%, rgba(155, 114, 71, 0.1), transparent),
        linear-gradient(180deg, #ece8e3 0%, #eae5e1 45%, #e5dfd9 100%);
}
</style>
