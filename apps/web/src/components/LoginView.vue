<template>
    <div class="archive-panel w-full max-w-md min-w-0 p-6 md:p-9">
        <!-- 眉题 -->
        <div class="kicker mb-6">
            <span class="truncate">QRShare / Transmission Terminal</span>
            <span class="shrink-0">v2.0</span>
        </div>

        <!-- 标题 -->
        <h1 class="text-3xl font-normal m-0 tracking-wide">二维码分享器</h1>
        <p class="text-sm mt-2 mb-0" style="color: var(--muted)">一人扫码，全宿舍签到</p>

        <div class="hairline-t mt-6 pt-6">
            <label class="block text-[11px] tracking-[2px] uppercase mb-2" style="color: var(--muted)">用户名 / Username</label>
            <input
                v-model="username"
                class="input-line"
                placeholder="输入你的用户名"
                maxlength="20"
                @keyup.enter="handleLogin"
            />
        </div>

        <!-- 角色 -->
        <div class="mt-6">
            <label class="block text-[11px] tracking-[2px] uppercase mb-2" style="color: var(--muted)">角色 / Role</label>
            <div class="grid grid-cols-2 gap-2">
                <button
                    v-for="(opt, i) in roleOptions"
                    :key="opt.value"
                    type="button"
                    class="role-cell"
                    :class="{ selected: role === opt.value }"
                    @click="role = opt.value"
                >
                    <div class="flex items-baseline justify-between w-full">
                        <span class="text-[11px] tracking-[1.5px]" :style="role === opt.value ? 'color: var(--accent)' : 'color: var(--muted)'">0{{ i + 1 }}</span>
                        <span class="text-[10px] tracking-[1.5px] uppercase opacity-60">{{ opt.en }}</span>
                    </div>
                    <div class="text-base font-semibold mt-3">{{ opt.label }}</div>
                    <div class="text-xs mt-1 leading-relaxed opacity-60">{{ opt.desc }}</div>
                </button>
            </div>
        </div>

        <p v-if="error" class="text-sm mt-4 mb-0" style="color: #b3402e">{{ error }}</p>

        <button class="btn btn-solid w-full mt-7" @click="handleLogin">进入终端</button>

        <div class="hairline-t mt-7 pt-4 flex justify-between text-[11px] tracking-[1.5px] uppercase" style="color: var(--muted)">
            <span>No Auth Required</span>
            <span>Rhine Style</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, type FunctionalComponent, h } from 'vue';
import { useRouter } from 'vue-router';

type Role = 'sender' | 'receiver';

const router = useRouter();
const username = ref('');
const role = ref<Role>('receiver');
const error = ref('');

const CameraIcon: FunctionalComponent = () =>
    h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, class: 'w-6 h-6' }, [
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 9a2 2 0 012-2h1.5a2 2 0 001.6-.8l1.2-1.6A2 2 0 0110 4h4a2 2 0 011.7.9l1.2 1.7a2 2 0 001.6.8H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' }),
        h('circle', { cx: 12, cy: 13, r: 3.5 }),
    ]);

const ScreenIcon: FunctionalComponent = () =>
    h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, class: 'w-6 h-6' }, [
        h('rect', { x: 3, y: 4, width: 18, height: 12, rx: 1 }),
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8 20h8m-4-4v4' }),
    ]);

const roleOptions: { value: Role; label: string; en: string; desc: string; icon: FunctionalComponent }[] = [
    { value: 'receiver', label: '接收者', en: 'Receiver', desc: '进入房间，等待显示二维码', icon: ScreenIcon },
    { value: 'sender', label: '发送者', en: 'Sender', desc: '开启摄像头扫码分享', icon: CameraIcon },
];

const handleLogin = () => {
    if (!username.value.trim()) {
        error.value = '用户名不能为空';
        return;
    }

    localStorage.setItem('username', username.value.trim());
    localStorage.setItem('role', role.value);

    if (role.value === 'sender') {
        router.replace('/sender');
    } else {
        router.replace('/receiver');
    }
};
</script>

<style scoped>
.role-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    transition:
        border-color 0.15s ease,
        background 0.15s ease,
        color 0.15s ease;
}

.role-cell:hover {
    border-color: var(--ink);
}

.role-cell.selected {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
}
</style>
