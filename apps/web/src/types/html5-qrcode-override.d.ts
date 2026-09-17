declare module "html5-qrcode" {
    export interface CameraDevice {
        id: string;
        label: string;
    }

    export interface QrcodeSuccessCallback {
        (decodedText: string, decodedResult: any): void;
    }

    export interface QrcodeErrorCallback {
        (errorMessage: string): void;
    }

    export interface Html5QrcodeConfigs {
        fps?: number;
        qrbox?: { width: number; height: number } | Function;
        aspectRatio?: number;
        // 允许传入 focusMode/zoom 等非标准约束，具体见
        // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
        videoConstraints?: any;
    }

    export interface Html5QrcodeCameraCapabilities {
        zoomFeature: () => {
            min: () => number;
            max: () => number;
            step: () => number;
        };
    }

    export class Html5Qrcode {
        constructor(elementId: string, config?: any);
        static getCameras(): Promise<CameraDevice[]>;
        start(
            cameraIdOrConfig: string | { facingMode: string },
            config: Html5QrcodeConfigs,
            qrCodeSuccessCallback: QrcodeSuccessCallback,
            qrCodeErrorCallback?: QrcodeErrorCallback,
        ): Promise<void>;
        stop(): Promise<void>;
        clear(): void;
        pause(): void;
        resume(): void;
        applyVideoConstraints(constraints: any): Promise<void>;
        getRunningTrackCameraCapabilities(): Html5QrcodeCameraCapabilities;
    }
    export default Html5Qrcode;
}
