<template>
  <div class="bg-white p-4 rounded-2xl w-5/6 h-5/6 grid grid-cols-2">
    <div class="sender-list border-r w-1/3">
      <ul>
        <li v-for="(room, i) in roomList" :key="i"
          @click="currentRoomIndex == i ? currentRoomIndex = undefined : currentRoomIndex = i"
          :class="{ active: currentRoomIndex === i }" class="cursor-pointer p-2">
          {{ room }}
        </li>
      </ul>
      <p v-if="roomList.length === 0">暂无可用房间...</p>
    </div>

    <div class="display-area">
      <div v-if="currentRoomIndex !== undefined">
        <h3>正在接收 [{{ currentRoomName }}] 二维码:</h3>
        <div class="qr-content" v-if="lastQrData">
          <a-qrcode :value="lastQrData" />
          <div class=" mt-3">接收时间: {{ lastQrTime }}</div>
        </div>
        <div v-else>等待扫码...</div>
      </div>
      <div v-else>
        请先在左侧选择一个房间进入
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import socket from '../socket.ts';
import router from '../router';
import type { RoomData, RoomsListResponse } from '@qrshare/shared';

// 从 localStorage 获取用户信息
const username = ref(localStorage.getItem('username') || '');
const role = ref<'sender' | 'receiver'>((localStorage.getItem('role') as 'sender' | 'receiver') || 'receiver');

const roomList = ref<string[]>([]);
const currentRoomIndex = ref<number | undefined>();
const currentRoomName = ref<string>('');
const lastQrData = ref('');
const lastQrTime = ref('');

watch(currentRoomIndex, (newVal) => {
  // 离开旧房间
  if (currentRoomName.value !== '') {
    socket.emit('leaveRoom', {
      username: username.value,
      role: role.value,
      roomName: currentRoomName.value
    });
  }
  if (newVal === undefined) {
    currentRoomName.value = '';
    return;
  }
  currentRoomName.value = roomList.value[newVal] ?? '';
  // 加入新房间
  socket.emit('joinRoom', {
    username: username.value,
    role: role.value,
    roomName: currentRoomName.value
  }, (response: RoomData) => {
    lastQrData.value = response.data || '';
    lastQrTime.value = response.timestamp ? new Date(response.timestamp).toLocaleString() : '';
  });
});

onMounted(() => {
  // 检查用户信息
  if (!username.value || role.value !== 'receiver') {
    router.replace('/');
    return;
  }

  // 连接 socket
  if (!socket.connected) {
    socket.connect();
  }

  // 请求当前房间列表
  socket.emit('getRooms', {
    username: username.value,
    role: role.value
  }, (response: RoomsListResponse) => {
    roomList.value = response.rooms;
  });

  // 监听新房间创建
  socket.on('newRoom', (payload) => {
    if (!roomList.value.includes(payload.roomName)) {
      roomList.value.push(payload.roomName);
    }
  });

  // 监听房间删除
  socket.on('roomDrop', (payload) => {
    roomList.value = roomList.value.filter(room => room !== payload.roomName);
    // 如果当前房间被删除，清空显示
    if (currentRoomName.value === payload.roomName) {
      currentRoomIndex.value = undefined;
    }
  });

  // 监听二维码数据
  socket.on('newQrcode', (payload) => {
    console.log("Received QR code from ", payload.roomName, payload.data);
    if (payload.roomName !== currentRoomName.value) {
      console.log("QR code room does not match current room, ignoring.");
      return;
    }
    lastQrData.value = payload.data;
    lastQrTime.value = new Date(payload.timestamp).toLocaleString();
  });
});


onUnmounted(() => {
  socket.disconnect();
});
</script>

<style scoped>
.active {
  background-color: #e2e2e2;
}

li:hover {
  background-color: #e2e2e2;
}

.qr-content h1 {
  color: #2c3e50;
  font-size: 2em;
  word-break: break-all;
}
</style>
