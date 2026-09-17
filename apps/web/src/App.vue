<template>
    <div id="app" class="min-h-screen w-full flex items-center justify-center p-4 md:p-8 app-bg">
        <!-- 顶部刻度装饰 -->
        <div class="deco-ticks" aria-hidden="true"></div>

        <!-- 主题切换 -->
        <button class="theme-toggle" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleTheme">
            <span class="status-light" :class="isDark ? 'on' : 'wait'"></span>
            <span class="tracking-[2px]">{{ isDark ? 'DARK' : 'LIGHT' }}</span>
        </button>

        <router-view v-slot="{ Component }">
            <transition name="page" mode="out-in">
                <component :is="Component" />
            </transition>
        </router-view>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const isDark = ref(false);

const applyTheme = (dark: boolean) => {
    isDark.value = dark;
    document.documentElement.dataset.theme = dark ? 'dark' : '';
};

const toggleTheme = () => {
    const next = !isDark.value;
    applyTheme(next);
    localStorage.setItem('qrshare-theme', next ? 'dark' : 'light');
};

onMounted(() => {
    const saved = localStorage.getItem('qrshare-theme');
    const prefers = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyTheme(saved ? saved === 'dark' : !!prefers);
});
</script>

<style scoped>
.app-bg {
    background:
        radial-gradient(ellipse 90% 60% at 12% -10%, rgba(197, 161, 107, 0.14), transparent),
        radial-gradient(ellipse 70% 55% at 95% 8%, rgba(155, 114, 71, 0.1), transparent),
        linear-gradient(180deg, #ece8e3 0%, #eae5e1 45%, #e5dfd9 100%);
    transition: background 0.35s ease;
}

[data-theme="dark"] .app-bg {
    background:
        radial-gradient(ellipse 90% 60% at 12% -10%, rgba(197, 161, 107, 0.1), transparent),
        radial-gradient(ellipse 70% 55% at 95% 8%, rgba(83, 97, 102, 0.25), transparent),
        linear-gradient(180deg, #131b1f 0%, #11181b 45%, #0d1417 100%);
}

/* 顶部细刻度线 */
.deco-ticks {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    pointer-events: none;
    background: repeating-linear-gradient(
        90deg,
        var(--line) 0 1px,
        transparent 1px 72px
    );
    opacity: 0.55;
    -webkit-mask: linear-gradient(180deg, #000 0 1px, transparent 1px);
    mask: linear-gradient(180deg, #000 0 1px, transparent 1px);
}

.theme-toggle {
    position: fixed;
    top: 14px;
    right: 16px;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 10px;
    letter-spacing: 2px;
    color: var(--muted);
    background: color-mix(in srgb, var(--panel) 70%, transparent);
    border: 1px solid var(--line);
    border-radius: 2px;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition:
        border-color 0.18s ease,
        color 0.18s ease,
        transform 0.12s ease;
}

.theme-toggle:hover {
    border-color: var(--accent-deep);
    color: var(--accent-deep);
}

.theme-toggle:active {
    transform: scale(0.95);
}
</style>
