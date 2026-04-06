<template>
  <div class="bg-white p-4 rounded-2xl w-5/6 h-5/6">
    <div class="status-bar">
      <p>当前用户: <strong>{{ username }}</strong></p>
    </div>

    <div id="reader" class="w-auto h-auto mb-4"></div>
    <span>缩放：</span>
    <a-slider v-model:value="zoomRatio" :min="zoomMin" :max="zoomMax" :step="zoomStep" />
    <a-button v-if="isCameraOn" @click="pauseCamera()" size="large">暂停</a-button>
    <a-button v-else @click="resumeCamera()" size="large">恢复</a-button>
  </div>
</template>

<script setup lang="ts">
import * as Html5QrcodeModule from 'html5-qrcode';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import socket from '../socket.ts';
import router from '../router';

// html5-qrcode 使用 CommonJS 格式，需要这样获取类
const Html5Qrcode = (Html5QrcodeModule as any).Html5Qrcode;
type CameraDevice = { id: string; label: string };

// 从 localStorage 获取用户信息
const username = ref(localStorage.getItem('username') || '');
const role = ref<'sender' | 'receiver'>((localStorage.getItem('role') as 'sender' | 'receiver') || 'receiver');

const cameraSelect = ref(1);
const zoomRatio = ref(1);
const zoomMax = ref(1);
const zoomMin = ref(1);
const zoomStep = ref(0.25);
const isCameraOn = ref(true);
let data = '';

const frameConfig = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
};

const onScanSuccess = (decodedText: string) => {
  if (data === decodedText) {
    return;
  }
  data = decodedText;
  // 发送二维码到服务器
  socket.emit('qrCode', {
    username: username.value,
    role: role.value,
    data: decodedText
  });
};

watch(zoomRatio, () => {
  setZoom(zoomRatio.value)
})

let setZoom = (_: number) => { };
let resumeCamera = () => { }
let pauseCamera = () => { };

onUnmounted(() => {
  socket.disconnect();
});

onMounted(() => {
  // 检查用户信息
  if (!username.value || role.value !== 'sender') {
    router.replace('/');
    return;
  }

  // 连接 socket
  if (!socket.connected) {
    socket.connect();
  }

  Html5Qrcode.getCameras().then((devices: CameraDevice[]) => {
    const cameraId = devices[cameraSelect.value]?.id;
    return cameraId
  }).then((cameraId: string | undefined) => {
    const reader = new Html5Qrcode('reader');
    if (!cameraId) {
      throw Error("camera not found")
    }
    reader.start(
      cameraId,
      frameConfig,
      onScanSuccess,
      undefined
    ).then(() => {
      setZoom = (ratio: number) => {
        reader.applyVideoConstraints({
          advanced: [{ zoom: ratio }]
        })
      }
      pauseCamera = () => {
        reader.pause()
        isCameraOn.value = false;
      }
      resumeCamera = () => {
        reader.resume()
        isCameraOn.value = true;
      }
      const zoomAblity = reader.getRunningTrackCameraCapabilities().zoomFeature();
      zoomMax.value = zoomAblity.max()
      zoomMin.value = zoomAblity.min()
      zoomStep.value = zoomAblity.step()
    })
  }).catch((e: unknown) => {
    console.error(e)
  });
});

</script>
