<template>
    <div class="archive-panel w-full max-w-5xl min-w-0 p-5 md:p-8">
        <!-- 眉题 -->
        <div class="kicker mb-5 rise" style="--d: 0ms">
            <span>Receiver / Display Module</span>
            <button class="flex items-center gap-2 text-[11px] tracking-[1.5px] uppercase hover:opacity-70 transition-opacity" style="color: var(--muted)" @click="refreshRooms">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5.2 8.5A8 8 0 0119.4 6M18.8 15.5A8 8 0 014.6 18" />
                </svg>
                Refresh
            </button>
        </div>

        <!-- 操作员行 -->
        <div class="hairline-t pt-4 flex items-end justify-between gap-4 flex-wrap rise" style="--d: 40ms">
            <div>
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Operator / 接收者</div>
                <div class="text-2xl font-semibold tracking-wide">{{ username }}</div>
            </div>
            <div class="text-right">
                <div class="text-[11px] tracking-[2px] uppercase mb-1" style="color: var(--muted)">Rooms / 在线房间</div>
                <div class="text-sm font-medium">
                    <RollingNumber :value="roomList.length" /> 个
                </div>
            </div>
        </div>

        <div class="grid md:grid-cols-[280px_1fr] gap-6 mt-5 rise" style="--d: 90ms">
            <!-- 房间列表 -->
            <div class="md:border-r md:pr-5" style="border-color: var(--line)">
                <transition-group name="room-list" tag="div" class="flex flex-col gap-1.5">
                    <button v-for="(room, i) in roomList" :key="room"
                            class="room-item" :class="{ active: currentRoomName === room }"
                            @click="selectRoom(room)">
                        <span class="room-index">{{ String(i + 1).padStart(2, '0') }}</span>
                        <span class="truncate">{{ room }}</span>
                        <span v-if="currentRoomName === room" class="status-light on ml-auto shrink-0"></span>
                    </button>
                </transition-group>
                <div v-if="roomList.length === 0" class="hairline-t mt-4 pt-4">
                    <div class="standby-mark mx-auto" style="transform: scale(0.6)"></div>
                    <p class="text-center text-[12px] mt-2 mb-0" style="color: var(--muted)">暂无房间，等待发送者开启分享…</p>
                </div>
            </div>

            <!-- 显示区域 -->
            <div class="flex flex-col items-center justify-center min-h-[400px]">
                <!-- 未选择 -->
                <div v-if="!currentRoomName && !roomClosed" class="text-center">
                    <div class="standby-mark mx-auto"></div>
                    <p class="text-sm mt-5 mb-0" style="color: var(--muted)">从左侧选择一个房间进入</p>
                </div>

                <!-- 房间关闭 -->
                <div v-else-if="roomClosed" class="text-center">
                    <div class="standby-mark mx-auto" style="border-color: var(--danger)"></div>
                    <p class="text-base mt-5 mb-0" style="color: var(--danger)">发送者已离开，房间已关闭</p>
                    <p class="text-[12px] mt-1 mb-5" style="color: var(--muted)">请重新选择其他房间</p>
                    <button class="btn btn-line" @click="roomClosed = false">知道了</button>
                </div>

                <!-- 等待传输 -->
                <div v-else-if="!lastQrData" class="text-center">
                    <div class="standby-mark mx-auto"></div>
                    <p class="text-lg mt-6 mb-0 font-medium">等待发送者传输...</p>
                    <p class="text-[11px] tracking-[2px] uppercase mt-2 mb-0" style="color: var(--muted)">Standby · Room 「{{ currentRoomName }}」</p>
                </div>

                <!-- 二维码 -->
                <div v-else class="flex flex-col items-center">
                    <div class="relative p-5 bg-white overflow-hidden" style="border: 1px solid var(--ink); border-radius: 2px">
                        <transition name="qr-reveal" mode="out-in">
                            <a-qrcode :key="lastQrData" :value="lastQrData" :size="qrSize" error-level="M" />
                        </transition>
                        <i v-if="qrFlash" :key="qrFlash" class="qr-flash"></i>
                    </div>
                    <div class="text-base font-semibold mt-5">「{{ currentRoomName }}」</div>
                    <div class="text-[11px] tracking-[1.5px] uppercase mt-1.5" style="color: var(--muted)">
                        Updated · {{ lastQrTime }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import socket from '../socket.ts';
import router from '../router';
import RollingNumber from './RollingNumber.vue';
import type { RoomData, RoomsListResponse } from '@qrshare/shared';

const username = ref(localStorage.getItem('username') || '');
const role = ref<'sender' | 'receiver'>((localStorage.getItem('role') as 'sender' | 'receiver') || 'receiver');

const roomList = ref<string[]>([]);
const currentRoomName = ref('');
const roomClosed = ref(false);
const lastQrData = ref('');
const lastQrTime = ref('');
const refreshing = ref(false);
const qrFlash = ref(0);

const qrSize = computed(() => (window.innerWidth < 640 ? 220 : 280));

const refreshRooms = () => {
    refreshing.value = true;
    socket.emit('getRooms', { username: username.value, role: role.value }, (res: RoomsListResponse) => {
        roomList.value = res.rooms;
        refreshing.value = false;
    });
};

const joinRoom = (roomName: string) => {
    socket.emit('joinRoom', { username: username.value, role: role.value, roomName }, (res: RoomData) => {
        lastQrData.value = res.data || '';
        lastQrTime.value = res.timestamp ? new Date(res.timestamp).toLocaleString() : '';
    });
};

const selectRoom = (roomName: string) => {
    if (currentRoomName.value === roomName) return;
    // 离开旧房间
    if (currentRoomName.value) {
        socket.emit('leaveRoom', {
            username: username.value,
            role: role.value,
            roomName: currentRoomName.value,
        });
    }
    currentRoomName.value = roomName;
    roomClosed.value = false;
    lastQrData.value = '';
    lastQrTime.value = '';
    joinRoom(roomName);
};

const onNewRoom = (payload: { roomName: string }) => {
    if (!roomList.value.includes(payload.roomName)) {
        roomList.value.push(payload.roomName);
    }
};

const onRoomDrop = (payload: { roomName: string }) => {
    roomList.value = roomList.value.filter((room) => room !== payload.roomName);
    if (currentRoomName.value === payload.roomName) {
        currentRoomName.value = '';
        lastQrData.value = '';
        lastQrTime.value = '';
        roomClosed.value = true;
    }
};

const onNewQrcode = (payload: { roomName: string; data: string; timestamp: number }) => {
    if (payload.roomName !== currentRoomName.value) return;
    lastQrData.value = payload.data;
    lastQrTime.value = new Date(payload.timestamp).toLocaleString();
    qrFlash.value = Date.now();
};

onMounted(() => {
    if (!username.value || role.value !== 'receiver') {
        router.replace('/');
        return;
    }

    if (!socket.connected) {
        socket.connect();
    }

    refreshRooms();

    socket.on('newRoom', onNewRoom);
    socket.on('roomDrop', onRoomDrop);
    socket.on('newQrcode', onNewQrcode);
});

onUnmounted(() => {
    socket.off('newRoom', onNewRoom);
    socket.off('roomDrop', onRoomDrop);
    socket.off('newQrcode', onNewQrcode);

    if (currentRoomName.value) {
        socket.emit('leaveRoom', {
            username: username.value,
            role: role.value,
            roomName: currentRoomName.value,
        });
    }
    socket.disconnect();
});
</script>
