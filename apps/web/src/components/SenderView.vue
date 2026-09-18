<template>
    <div class="archive-panel w-full max-w-2xl min-w-0 p-5 md:p-8">
        <!-- 眉题 -->
        <div class="kicker mb-5 rise" style="--d: 0ms">
            <span>Sender / Scan Module</span>
            <span class="flex items-center gap-2 normal-case tracking-normal text-[12px]">
                <span class="status-light" :class="roomStatus === 'ready' ? 'on' : 'wait'"></span>
                {{ roomStatus === 'ready' ? 'Link Active' : 'Connecting' }}
            </span>
        </div>

        <!-- 操作员行 -->
        <div class="hairline-t pt-4 flex items-end justify-between gap-4 flex-wrap rise" style="--d: 40ms">
            <div>
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Operator / 发送者</div>
                <div class="text-2xl font-semibold tracking-wide">{{ username }}</div>
            </div>
            <div class="text-right">
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Room / 房间</div>
                <div class="text-sm font-medium">{{ username }}</div>
            </div>
        </div>

        <!-- 取景器：点按对焦 · 双指捏合变焦 -->
        <div class="vf rise" style="--d: 80ms"
             :class="{ paused: paused, 'vf-touch': focusStatus === 'focusing' }"
             @pointerdown="onPointerDown"
             @pointermove="onPointerMove"
             @pointerup="onPointerUp"
             @pointercancel="onPointerUp"
             @wheel.prevent="onWheel">
            <div id="reader" class="w-full h-full"></div>

            <!-- 四角框 + 扫描线 -->
            <div v-if="cameraRunning && !paused" class="scan-frame">
                <span></span><span></span><span></span><span></span>
                <i class="scan-line"></i>
            </div>

            <!-- 点按对焦框 -->
            <div v-if="focusMark" :key="focusMark.id" class="focus-mark"
                 :class="focusStatus"
                 :style="{ left: focusMark.x + 'px', top: focusMark.y + 'px' }">
                <i class="focus-arc"></i>
            </div>

            <!-- 对焦提示 -->
            <div v-if="focusHint" class="vf-hint">{{ focusHint }}</div>

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
        <div v-if="lastSent" class="mt-4 flex items-baseline gap-3 text-[12px] rise" style="--d: 120ms; color: var(--accent-deep)">
            <span class="tracking-[1.5px] uppercase shrink-0">Last Transmission</span>
            <span class="truncate font-medium">{{ lastSent }}</span>
        </div>

        <!-- 镜头切换：主摄 / 超广角 / 长焦（浏览器可见的多个后置镜头） -->
        <div v-if="lenses.length > 1" class="mt-5 flex items-center gap-2 flex-wrap rise" style="--d: 130ms">
            <span class="text-[11px] tracking-[2px] uppercase shrink-0" style="color: var(--muted)">Lens</span>
            <button v-for="(lens, i) in lenses" :key="lens.id"
                    class="mf-chip" :class="{ active: currentLens === i }"
                    :disabled="lensSwitching"
                    @click="switchLens(i)">
                {{ lensLabel(i, lens.label) }}
            </button>
        </div>

        <!-- 变焦：真实镜头变焦 -->
        <div v-if="caps.zoom" class="mt-4 flex items-center gap-4 rise" style="--d: 140ms">
            <span class="text-[11px] tracking-[2px] uppercase shrink-0" style="color: var(--muted)">Zoom</span>
            <button class="zoom-chip" title="缩小" @click="zoomBy(1 / 1.25)">−</button>
            <input type="range" class="slider-line" :value="zoomValue"
                   :min="caps.zoom.min" :max="caps.zoom.max" :step="caps.zoom.step"
                   @input="setZoom(Number(($event.target as HTMLInputElement).value))" />
            <button class="zoom-chip" title="放大" @click="zoomBy(1.25)">＋</button>
            <span class="text-[14px] shrink-0 w-14 text-right font-semibold">
                <RollingNumber :value="zoomValue" :decimals="1" />x
            </span>
        </div>

        <!-- 手动对焦距离（镜头马达） -->
        <div v-if="caps.focusDistance" class="mt-4 flex items-center gap-4 rise" style="--d: 160ms">
            <button class="mf-chip" :class="{ active: !manualFocus }" @click="autoFocus">AF</button>
            <input type="range" class="slider-line" :value="mfNormalized"
                   min="0" max="1" step="0.01"
                   @input="onMfInput" />
            <span class="text-[11px] tracking-[2px] uppercase shrink-0" style="color: var(--muted)">MF</span>
        </div>

        <!-- 操作 -->
        <div class="hairline-t mt-6 pt-5 flex gap-2 flex-wrap rise" style="--d: 180ms">
            <button v-if="cameraRunning && !paused" class="btn btn-line" @click="pauseCamera">暂停</button>
            <button v-if="paused" class="btn btn-line" @click="resumeCamera">恢复</button>
            <button v-if="caps.torch" class="btn btn-line" :class="{ 'btn-amber': torchOn }" @click="toggleTorch">
                {{ torchOn ? '关灯' : '补光' }}
            </button>
            <button class="btn btn-danger ml-auto" @click="leave">结束分享</button>
        </div>

        <p class="text-[12px] mt-4 mb-1 rise" style="--d: 200ms; color: var(--muted)">
            对准取景框自动识别 · 点按画面手动对焦 · 双指捏合或滑条变焦 · 距离太近可切「广角」镜头
        </p>
    </div>
</template>

<script setup lang="ts">
import * as Html5QrcodeModule from 'html5-qrcode';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import socket from '../socket.ts';
import router from '../router';
import RollingNumber from './RollingNumber.vue';
import { useCameraControl } from '../composables/useCameraControl.ts';

const Html5Qrcode = (Html5QrcodeModule as any).Html5Qrcode;

const username = ref(localStorage.getItem('username') || '');
const role = ref<'sender' | 'receiver'>((localStorage.getItem('role') as 'sender' | 'receiver') || 'receiver');

const roomStatus = ref<'pending' | 'ready'>('pending');
const cameraRunning = ref(false);
const paused = ref(false);
const cameraError = ref('');
const lastSent = ref('');
const focusMark = ref<{ x: number; y: number; id: number } | null>(null);
const focusHint = ref('');
const lenses = ref<{ id: string; label: string }[]>([]);
const currentLens = ref(0);
const lensSwitching = ref(false);

let reader: InstanceType<typeof Html5Qrcode> | null = null;
let lastData = '';
let hintTimer: ReturnType<typeof setTimeout> | undefined;

const getVideoEl = () => document.querySelector<HTMLVideoElement>('#reader video');

const {
    caps, focusStatus, zoomValue, focusDistanceValue, manualFocus, torchOn,
    attach, detach, tapFocus, autoFocus, setFocusDistance, setZoom, zoomBy, toggleTorch,
} = useCameraControl(getVideoEl);

const mfNormalized = computed(() => {
    const fd = caps.value.focusDistance;
    if (!fd) return 0;
    return (focusDistanceValue.value - fd.min) / (fd.max - fd.min);
});

const onMfInput = (e: Event) => setFocusDistance(Number((e.target as HTMLInputElement).value));

const createRoom = (): Promise<boolean> =>
    new Promise((resolve) => {
        socket.emit('createRoom', { username: username.value, role: role.value }, (res: { success: boolean }) => {
            resolve(res.success);
        });
    });

const startCamera = async (deviceId?: string) => {
    cameraError.value = '';
    try {
        reader = new Html5Qrcode('reader');

        // 关键：请求高分辨率视频流。低分辨率流是“放大糊成一片”的根因——
        // 数码放大的是 480p 的像素。1080p/4K 流配合镜头变焦才有原生相机质感。
        // 注意：html5-qrcode 在提供 videoConstraints 时会忽略 cameraIdOrConfig，
        // 镜头切换必须通过 deviceId 写进 videoConstraints 生效。
        const videoConstraints: Record<string, unknown> = {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }],
        };
        if (deviceId) {
            videoConstraints.deviceId = { ideal: deviceId };
        } else {
            videoConstraints.facingMode = 'environment';
        }

        await reader.start(
            deviceId ?? { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 230, height: 230 },
                videoConstraints,
            },
            onScanSuccess,
            () => {},
        );

        // 等视频轨就绪后探测能力（对焦/变焦/对焦距离/闪光灯）
        const video = getVideoEl();
        if (video && !video.videoWidth) {
            await new Promise<void>((resolve) => {
                video.addEventListener('loadeddata', () => resolve(), { once: true });
                setTimeout(resolve, 1500);
            });
        }
        await attach();

        cameraRunning.value = true;
        await enumerateLenses();
    } catch (e) {
        console.error(e);
        // 指定镜头启动失败（部分机型拒绝浏览器调用超广角）时回退默认镜头
        if (deviceId) {
            currentLens.value = 0;
            await startCamera();
            return;
        }
        cameraError.value = '无法开启摄像头，请检查浏览器权限，或通过 HTTPS 访问';
    }
};

/** 枚举浏览器可见的后置镜头（超广角等），供手动切换 */
const enumerateLenses = async () => {
    try {
        const devices: { id: string; label: string }[] = await Html5Qrcode.getCameras();
        const back = devices.filter((d) => !/front|前置/i.test(d.label || ''));
        if (back.length > 1) {
            lenses.value = back;
            return;
        }
    } catch {
        /* 忽略枚举失败 */
    }
    lenses.value = [];
};

/** 镜头显示名：优先读设备 label 里的焦段线索，否则按序号命名 */
const lensLabel = (i: number, label: string) => {
    const l = (label || '').toLowerCase();
    if (/ultra|wide|0\.5|0\.6/.test(l) && !/tele/.test(l)) return '广角';
    if (/tele|macro/.test(l)) return l.includes('macro') ? '微距' : '长焦';
    return i === 0 ? '主摄' : `镜头${i + 1}`;
};

/** 切换镜头：停止当前流后用新 deviceId 重启 */
const switchLens = async (idx: number) => {
    if (idx === currentLens.value || !reader || lensSwitching.value) return;
    const lens = lenses.value[idx];
    if (!lens) return;
    lensSwitching.value = true;
    currentLens.value = idx;
    zoomValue.value = 1; // 新镜头的变焦量程不同，重置避免越界
    try {
        await reader.stop();
    } catch {
        /* 忽略 */
    }
    reader.clear();
    await startCamera(lens.id);
    lensSwitching.value = false;
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

/* ---------- 点按对焦 + 捏合变焦手势 ---------- */

const pointers = new Map<number, { x: number; y: number }>();
let pinchStartDist = 0;
let pinchStartZoom = 1;
let tapStart: { x: number; y: number; t: number } | null = null;
let tapMoved = false;

const vfRect = () => (document.querySelector('.vf') as HTMLElement | null)?.getBoundingClientRect();

/** object-fit: cover 下，把屏幕坐标换算成传感器画面归一化坐标 */
const toSensorPoint = (clientX: number, clientY: number) => {
    const video = getVideoEl();
    if (!video || !video.videoWidth) return null;
    const r = video.getBoundingClientRect();
    const scale = Math.max(r.width / video.videoWidth, r.height / video.videoHeight);
    const dispW = video.videoWidth * scale;
    const dispH = video.videoHeight * scale;
    const x = (clientX - r.left - (r.width - dispW) / 2) / dispW;
    const y = (clientY - r.top - (r.height - dispH) / 2) / dispH;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.98, Math.max(0.02, y)) };
};

const showHint = (text: string) => {
    focusHint.value = text;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (focusHint.value = ''), 1800);
};

const onPointerDown = (ev: PointerEvent) => {
    if (!cameraRunning.value || paused.value || cameraError.value) return;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom = zoomValue.value;
        tapStart = null; // 双指时不触发点按对焦
    } else {
        tapStart = { x: ev.clientX, y: ev.clientY, t: performance.now() };
        tapMoved = false;
    }
};

const onPointerMove = (ev: PointerEvent) => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.size === 2 && caps.value.zoom) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStartDist > 0) {
            setZoom(pinchStartZoom * (dist / pinchStartDist));
        }
    } else if (tapStart) {
        if (Math.hypot(ev.clientX - tapStart.x, ev.clientY - tapStart.y) > 12) tapMoved = true;
    }
};

const onPointerUp = (ev: PointerEvent) => {
    const wasPinch = pointers.size === 2;
    pointers.delete(ev.pointerId);

    if (!wasPinch && tapStart && !tapMoved && performance.now() - tapStart.t < 400) {
        const rect = vfRect();
        const pt = toSensorPoint(ev.clientX, ev.clientY);
        if (rect && pt) {
            focusMark.value = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, id: Date.now() };
            navigator.vibrate?.(12);
            tapFocus(pt.x, pt.y).then((mode) => {
                if (mode === 'unsupported') {
                    showHint('此设备不支持点按对焦，已使用自动对焦');
                } else if (mode === 'mode-only') {
                    showHint('设备不支持对焦点，已触发单次对焦');
                } else if (mode === 'pump') {
                    showHint('设备不支持对焦点，已重新驱动对焦马达');
                }
            });
        }
    }
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) tapStart = null;
};

const onWheel = (e: WheelEvent) => {
    if (!cameraRunning.value || paused.value || !caps.value.zoom) return;
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
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
    clearTimeout(hintTimer);
    detach();
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
