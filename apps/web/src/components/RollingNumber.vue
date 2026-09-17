<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
    value: number;
    decimals?: number;
    duration?: number;
}>(), {
    decimals: 0,
    duration: 460,
});

const prev = ref(props.value);
const animated = ref(props.value);
let raf = 0;

// 莱茵式滚动数字：数值变化时按 460ms 缓动逐位滚动，快速输入从当前位置接续
watch(() => props.value, (next) => {
    cancelAnimationFrame(raf);
    const from = prev.value;
    const start = performance.now();
    const tick = (now: number) => {
        const t = Math.min(1, (now - start) / props.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        animated.value = from + (next - from) * eased;
        if (t < 1) {
            raf = requestAnimationFrame(tick);
        } else {
            prev.value = next;
        }
    };
    raf = requestAnimationFrame(tick);
});

const chars = computed(() => animated.value.toFixed(props.decimals).split(''));

const digitOf = (ch: string) => (/[0-9]/.test(ch) ? Number(ch) : null);
</script>

<template>
    <span class="rolling-number" aria-hidden="true">
        <template v-for="(ch, i) in chars" :key="i">
            <span v-if="digitOf(ch) !== null" class="rn-digit">
                <span class="rn-col" :style="{ transform: `translateY(-${digitOf(ch)}em)` }">
                    <span v-for="d in 10" :key="d" class="rn-cell">{{ d - 1 }}</span>
                </span>
            </span>
            <span v-else class="rn-cell">{{ ch }}</span>
        </template>
    </span>
    <span class="sr-only">{{ value.toFixed(decimals) }}</span>
</template>

<style scoped>
.rolling-number {
    display: inline-flex;
    align-items: baseline;
    overflow: hidden;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

.rn-digit {
    display: inline-block;
    height: 1.1em;
    overflow: hidden;
}

.rn-col {
    display: flex;
    flex-direction: column;
    transition: transform 460ms cubic-bezier(0.22, 0.61, 0.21, 1);
    will-change: transform;
}

.rn-cell {
    display: block;
    height: 1.1em;
    line-height: 1.1em;
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
}

@media (prefers-reduced-motion: reduce) {
    .rn-col {
        transition: none;
    }
}
</style>
