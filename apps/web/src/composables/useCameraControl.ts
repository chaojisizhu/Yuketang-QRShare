import { onUnmounted, ref } from 'vue';

export interface RangeCap {
    min: number;
    max: number;
    step: number;
}

export interface CameraCaps {
    /** 设备支持的对焦模式列表，如 ['continuous','manual','single-shot'] */
    focusModes: string[];
    /** 是否支持 pointsOfInterest 对焦点 */
    hasPOI: boolean;
    /** 手动对焦距离（镜头马达），多数安卓 Chrome 支持 */
    focusDistance: RangeCap | null;
    /** 真实光学/镜头变焦 */
    zoom: RangeCap | null;
    /** 闪光灯 */
    torch: boolean;
}

export type FocusStatus = 'idle' | 'focusing' | 'locked' | 'unsupported';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// focusMode / pointsOfInterest / focusDistance / zoom / torch 均为 W3C 媒体捕获扩展，
// TS 官方 DOM 库尚未收录，统一走 any 通道直接传给 track.applyConstraints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adv = (o: any): MediaTrackConstraints => ({ advanced: [o] } as any);

/**
 * 直接操作 getUserMedia 视频轨道的对焦 / 变焦 / 闪光灯能力。
 *
 * 设计要点（对应 html5-qrcode 的 applyVideoConstraints 静默失败问题）：
 * - 启动时通过 track.getCapabilities() 探测真实能力，UI 只显示设备支持的控制项；
 * - 点按对焦采用「连续 → 手动 + POI」两段触发，促使对焦马达真正动作，
 *   2.5 秒后像原生相机一样重新锁定连续自动对焦；
 * - 变焦只使用轨道级 zoom 约束（真实镜头变焦），不做 CSS 数码放大。
 */
export function useCameraControl(getVideoEl: () => HTMLVideoElement | null) {
    const caps = ref<CameraCaps>({
        focusModes: [],
        hasPOI: false,
        focusDistance: null,
        zoom: null,
        torch: false,
    });

    const focusStatus = ref<FocusStatus>('idle');
    const zoomValue = ref(1);
    const focusDistanceValue = ref(0);
    const manualFocus = ref(false);
    const torchOn = ref(false);

    let track: MediaStreamTrack | null = null;
    let relockTimer: ReturnType<typeof setTimeout> | undefined;
    let lockAnimTimer: ReturnType<typeof setTimeout> | undefined;

    const getTrack = (): MediaStreamTrack | null => {
        if (track && track.readyState === 'live') return track;
        const stream = getVideoEl()?.srcObject as MediaStream | null | undefined;
        track = stream?.getVideoTracks()[0] ?? null;
        return track;
    };

    /** 摄像头启动后调用：探测能力并强制连续自动对焦 */
    const attach = async () => {
        const t = getTrack();
        if (!t) return;

        let raw: MediaTrackCapabilities | null = null;
        try {
            raw = t.getCapabilities() as MediaTrackCapabilities | null;
        } catch {
            raw = null;
        }

        const focusModes = Array.isArray((raw as any)?.focusMode)
            ? ((raw as any).focusMode as string[])
            : [];
        const fd = (raw as any)?.focusDistance;
        const z = (raw as any)?.zoom;

        caps.value = {
            focusModes,
            hasPOI: !!(raw as any)?.pointsOfInterest,
            focusDistance: fd && typeof fd.min === 'number' ? { min: fd.min, max: fd.max, step: fd.step || 0.01 } : null,
            zoom: z && typeof z.min === 'number' && z.max > z.min ? { min: z.min, max: z.max, step: z.step || 0.1 } : null,
            torch: Array.isArray((raw as any)?.torch) || (raw as any)?.torch === true,
        };

        const settings = t.getSettings() as any;
        if (settings?.zoom) zoomValue.value = settings.zoom;
        if (settings?.focusDistance) focusDistanceValue.value = settings.focusDistance;

        // 启动时强制连续自动对焦（部分设备默认为单次对焦）
        if (focusModes.includes('continuous')) {
            await t.applyConstraints(adv({ focusMode: 'continuous' })).catch(() => {});
        }
    };

    const detach = () => {
        clearTimeout(relockTimer);
        clearTimeout(lockAnimTimer);
        track = null;
        focusStatus.value = 'idle';
        manualFocus.value = false;
        torchOn.value = false;
    };

    /** 像原生相机一样：点哪里对哪里，稍后自动恢复连续对焦 */
    const tapFocus = async (x: number, y: number) => {
        const t = getTrack();
        if (!t) return 'unsupported' as const;
        const c = caps.value;

        clearTimeout(relockTimer);
        focusStatus.value = 'focusing';
        clearTimeout(lockAnimTimer);

        let applied = false;
        let appliedMode: 'poi' | 'mode-only' | 'pump' | null = null;

        // 第一段：先回连续对焦，清掉旧的单点锁定，促使马达复位
        if (c.focusModes.includes('continuous')) {
            await t.applyConstraints(adv({ focusMode: 'continuous' })).catch(() => {});
            await delay(60);
        }

        // 第二段：手动 + 对焦点（安卓 Chrome 的真实点按对焦路径）
        if (c.hasPOI && (c.focusModes.includes('manual') || c.focusModes.includes('single-shot'))) {
            const mode = c.focusModes.includes('manual') ? 'manual' : 'single-shot';
            try {
                await t.applyConstraints(adv({ focusMode: mode, pointsOfInterest: [{ x, y }] }));
                applied = true;
                appliedMode = 'poi';
            } catch {
                applied = false;
            }
        }

        // 退化路径一：仅单次对焦
        if (!applied && c.focusModes.includes('single-shot')) {
            try {
                await t.applyConstraints(adv({ focusMode: 'single-shot' }));
                applied = true;
                appliedMode = 'mode-only';
            } catch {
                applied = false;
            }
        }

        // 退化路径二：手动马达但无 POI —— 做一次「对焦泵」：
        // 有对焦距离就 近端→中端 拉一遍，没有则 手动锁定→交还连续，
        // 两种做法都会迫使镜头重新 hunting 合焦
        if (!applied && c.focusModes.includes('manual')) {
            try {
                await t.applyConstraints(adv({ focusMode: 'manual' }));
                if (c.focusDistance) {
                    const { min, max } = c.focusDistance;
                    await t.applyConstraints(adv({ focusMode: 'manual', focusDistance: min }));
                    await delay(140);
                    await t.applyConstraints(adv({ focusMode: 'manual', focusDistance: (min + max) / 2 }));
                    await delay(140);
                } else {
                    await delay(180);
                }
                await t.applyConstraints(adv({ focusMode: 'continuous' }));
                applied = true;
                appliedMode = 'pump';
            } catch {
                applied = false;
            }
        }

        if (!applied) {
            // 设备（如 iOS Safari）不暴露任何手动对焦能力
            focusStatus.value = 'unsupported';
            lockAnimTimer = setTimeout(() => (focusStatus.value = 'idle'), 1400);
            return 'unsupported' as const;
        }

        // 300ms 后视为合焦，对焦框由“扫描”转为“锁定”
        lockAnimTimer = setTimeout(() => {
            focusStatus.value = 'locked';
        }, 300);

        // 2.5s 后恢复连续自动对焦（原生相机的标准行为）
        relockTimer = setTimeout(() => {
            if (manualFocus.value) return;
            t.applyConstraints(adv({ focusMode: 'continuous' })).catch(() => {});
            focusStatus.value = 'idle';
        }, 2500);

        return appliedMode ?? ('mode-only' as const);
    };

    /** 恢复自动对焦 */
    const autoFocus = async () => {
        manualFocus.value = false;
        clearTimeout(relockTimer);
        const t = getTrack();
        if (t && caps.value.focusModes.includes('continuous')) {
            await t.applyConstraints(adv({ focusMode: 'continuous' })).catch(() => {});
        }
        focusStatus.value = 'idle';
    };

    /** 手动对焦距离（镜头马达），0..1 归一化到设备量程 */
    const setFocusDistance = async (normalized: number) => {
        const t = getTrack();
        const fd = caps.value.focusDistance;
        if (!t || !fd) return;
        const value = clamp(fd.min + normalized * (fd.max - fd.min), fd.min, fd.max);
        focusDistanceValue.value = value;
        manualFocus.value = true;
        clearTimeout(relockTimer);
        await t
            .applyConstraints(adv({ focusMode: 'manual', focusDistance: value }))
            .catch(() => {});
    };

    /** 真实镜头变焦（非数码放大） */
    const setZoom = (value: number) => {
        const t = getTrack();
        const z = caps.value.zoom;
        if (!t || !z) return;
        const v = clamp(value, z.min, z.max);
        if (Math.abs(v - zoomValue.value) < z.step / 2) return;
        zoomValue.value = v;
        t.applyConstraints(adv({ zoom: v })).catch(() => {});
    };

    const zoomBy = (ratio: number) => {
        const z = caps.value.zoom;
        if (!z) return;
        setZoom(zoomValue.value * ratio);
    };

    const toggleTorch = async () => {
        const t = getTrack();
        if (!t || !caps.value.torch) return;
        torchOn.value = !torchOn.value;
        await t.applyConstraints(adv({ torch: torchOn.value })).catch(() => {
            torchOn.value = !torchOn.value;
        });
    };

    onUnmounted(() => {
        clearTimeout(relockTimer);
        clearTimeout(lockAnimTimer);
    });

    return {
        caps,
        focusStatus,
        zoomValue,
        focusDistanceValue,
        manualFocus,
        torchOn,
        attach,
        detach,
        tapFocus,
        autoFocus,
        setFocusDistance,
        setZoom,
        zoomBy,
        toggleTorch,
    };
}
