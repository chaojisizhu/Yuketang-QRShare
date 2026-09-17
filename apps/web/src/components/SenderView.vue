<template>
    <div class="archive-panel w-full max-w-2xl min-w-0 p-5 md:p-8">
        <!-- 眉题 -->
        <div class="kicker mb-5">
            <span>Sender / Scan Module</span>
            <span class="flex items-center gap-2 normal-case tracking-normal text-[12px]">
                <span class="status-light" :class="roomStatus === 'ready' ? 'on' : 'wait'"></span>
                {{ roomStatus === 'ready' ? 'Link Active' : 'Connecting' }}
            </span>
        </div>

        <!-- 操作员行 -->
        <div class="hairline-t pt-4 flex items-end justify-between gap-4 flex-wrap">
            <div>
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Operator / 发送者</div>
                <div class="text-2xl font-semibold tracking-wide">{{ username }}</div>
            </div>
            <div class="text-right">
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Room / 房间</div>
                <div class="text-sm font-medium">{{ username }}</div>
            </div>
        </div>

        <!-- 摄像头 -->
        <div class="relative mt-5 bg-black aspect-[4/3] overflow-hidden" style="border: 1px solid var(--ink); border-radius: 2px">
            <div id="reader" class="w-full h-full"></div>

            <div v-if="cameraRunning && !paused" class="scan-frame">
                <span></span><span></span><span></span><span></span>
            </div>

            <div v-if="paused" class="absolute inset-0 flex flex-col items-center justify-center bg-black/75">
                <span class="text-[11px] tracking-[2.5px] uppercase" style="color: var(--accent)">Standby</span>
                <span class="text-white/70 text-sm mt-2">摄像头已暂停</span>
            </div>

            <div v-if="cameraError" class="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
                <span class="text-sm mb-4" style="color: #e0978a">{{ cameraError }}</span>
                <button class="btn btn-line !text-white !border-white/60" @click="retryCamera">重试</button>
            </div>
        </div>

        <!-- 最近传输 -->
        <div v-if="lastSent" class="mt-4 flex items-baseline gap-3 text-[12px]" style="color: var(--accent-deep)">
            <span class="tracking-[1.5px] uppercase shrink-0">Last Transmission</span>
            <span class="truncate font-medium">{{ lastSent }}</span>
        </div>

        <!-- 缩放 -->
        <div v-if="hasZoom" class="mt-5 flex items-center gap-4">
            <span class="text-[11px] tracking-[2px] uppercase shrink-0" style="color: var(--muted)">Zoom</span>
            <input type="range" class="slider-line" v-model.number="zoomRatio"
                   :min="zoomMin" :max="zoomMax" :step="zoomStep" @input="setZoom" />
            <span class="text-[12px] shrink-0 w-12 text-right font-medium">{{ zoomRatio.toFixed(1) }}x</span>
        </div>

        <!-- 操作 -->
        <div class="hairline-t mt-6 pt-5 flex gap-2 flex-wrap">
            <button v-if="cameraRunning && !paused" class="btn btn-line" @click="pauseCamera">暂停</button>
            <button v-if="paused" class="btn btn-line" @click="resumeCamera">恢复</button>
            <button class="btn btn-danger ml-auto" @click="leave">结束分享</button>
        </div>

        <p class="text-[12px] mt-4 mb-0" style="color: var(--muted)">将雨课堂二维码对准取景框，识别后自动传输给房间内的接收者</p>
    </div>
</template>

<script setup lang="ts">
import * as Html5QrcodeModule from 'html5-qrcode';
import { onMounted, onUnmounted, ref } from 'vue';
import socket from '../socket.ts';
import router from '../router';

const Html5Qrcode = (Html5QrcodeModule as any).Html5Qrcode;

const username = ref(localStorage.getItem('username') || '');
const role = ref<'sender' | 'receiver'>((localStorage.getItem('role') as 'sender' | 'receiver') || 'receiver');

const roomStatus = ref<'pending' | 'ready'>('pending');
const cameraRunning = ref(false);
const paused = ref(false);
const cameraError = ref('');
const lastSent = ref('');

const hasZoom = ref(false);
const zoomRatio = ref(1);
const zoomMin = ref(1);
const zoomMax = ref(1);
const zoomStep = ref(0.25);

let reader: InstanceType<typeof Html5Qrcode> | null = null;
let lastData = '';

const createRoom = (): Promise<boolean> =>
    new Promise((resolve) => {
        socket.emit('createRoom', { username: username.value, role: role.value }, (res: { success: boolean }) => {
            resolve(res.success);
        });
    });

const startCamera = async () => {
    cameraError.value = '';
    try {
        reader = new Html5Qrcode('reader');
        await reader.start(
            // 优先使用后置摄像头
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 220, height: 220 },
                // 请求连续自动对焦
                videoConstraints: {
                    focusMode: 'continuous',
                    advanced: [{ focusMode: 'continuous' }],
                },
            },
            onScanSuccess,
            () => {},
        );

        // 部分浏览器需要在流启动后再次强制连续对焦
        try {
            await reader.applyVideoConstraints({
                advanced: [{ focusMode: 'continuous' }],
            });
        } catch {
            // 设备不支持对焦设置时忽略
        }

        cameraRunning.value = true;

        // 检测变焦能力
        try {
            const caps = reader.getRunningTrackCameraCapabilities();
            if (caps && typeof caps.zoomFeature === 'function') {
                const z = caps.zoomFeature();
                zoomMin.value = z.min();
                zoomMax.value = z.max();
                zoomStep.value = z.step() || 0.1;
                hasZoom.value = zoomMax.value > zoomMin.value;
            }
        } catch {
            hasZoom.value = false;
        }
    } catch (e) {
        console.error(e);
        cameraError.value = '无法开启摄像头，请检查浏览器权限，或通过 HTTPS 访问';
    }
};

const onScanSuccess = (decodedText: string) => {
    if (lastData === decodedText) return;
    lastData = decodedText;
    socket.emit('qrCode', {
        username: username.value,
        role: role.value,
        data: decodedText,
    });
    lastSent.value = `${new Date().toLocaleTimeString()} · ${decodedText.slice(0, 40)}${decodedText.length > 40 ? '…' : ''}`;
};

const setZoom = () => {
    if (!reader) return;
    reader.applyVideoConstraints({
        advanced: [{ zoom: zoomRatio.value }],
    }).catch(() => {});
};

const pauseCamera = () => {
    reader?.pause();
    paused.value = true;
};

const resumeCamera = () => {
    reader?.resume();
    paused.value = false;
};

const retryCamera = () => {
    startCamera();
};

const leave = () => {
    router.replace('/');
};

onMounted(async () => {
    if (!username.value || role.value !== 'sender') {
        router.replace('/');
        return;
    }

    if (!socket.connected) {
        socket.connect();
    }

    // 先创建房间，再开启摄像头
    const ok = await createRoom();
    roomStatus.value = ok ? 'ready' : 'pending';

    await startCamera();
});

onUnmounted(() => {
    // 停止摄像头并断开连接（断开连接会触发服务端关闭房间）
    if (reader) {
        const r = reader;
        reader = null;
        if (cameraRunning.value) {
            r.stop().catch(() => {});
        }
        r.clear();
    }
    socket.disconnect();
});
</script>
