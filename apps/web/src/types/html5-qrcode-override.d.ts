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
            cameraId: string,
            config: Html5QrcodeConfigs,
            qrCodeSuccessCallback: QrcodeSuccessCallback,
            qrCodeErrorCallback?: QrcodeErrorCallback,
        ): Promise<void>;
        stop(): Promise<void>;
        pause(): void;
        resume(): void;
        applyVideoConstraints(constraints: any): Promise<void>;
        getRunningTrackCameraCapabilities(): Html5QrcodeCameraCapabilities;
    }
    export default Html5Qrcode;
}
