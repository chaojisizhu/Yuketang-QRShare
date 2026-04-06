import type { Room } from "@qrshare/shared";
import logger from "./logger.js";

// 房间过期时间：5分钟
const ROOM_EXPIRY_TIME = 5 * 60 * 1000;

// 过期检查间隔：30秒
const EXPIRY_CHECK_INTERVAL = 30 * 1000;

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private expiryCheckTimer: NodeJS.Timeout | null = null;

    /**
     * 创建房间（如果不存在）
     * @param senderName 发送者名称
     * @returns 房间对象
     */
    createRoom(senderName: string): Room {
        const existingRoom = this.rooms.get(senderName);
        if (existingRoom) {
            logger.debug(
                `Room ${senderName} already exists, returning existing room`,
            );
            return existingRoom;
        }

        const room: Room = {
            name: senderName,
            senderName,
            lastQrCode: null,
            lastTimestamp: null,
            lastActivityTime: Date.now(),
            receiverCount: 0,
        };

        this.rooms.set(senderName, room);
        logger.debug(`Room ${senderName} created`);
        return room;
    }

    /**
     * 获取房间
     * @param roomName 房间名称
     * @returns 房间对象或 undefined
     */
    getRoom(roomName: string): Room | undefined {
        return this.rooms.get(roomName);
    }

    /**
     * 更新房间活动时间
     * @param roomName 房间名称
     */
    updateActivity(roomName: string): void {
        const room = this.rooms.get(roomName);
        if (room) {
            room.lastActivityTime = Date.now();
            logger.debug(
                `Room ${roomName} activity updated to ${room.lastActivityTime}`,
            );
        }
    }

    /**
     * 设置房间二维码
     * @param roomName 房间名称
     * @param data 二维码数据
     * @returns 是否成功
     */
    setQrCode(roomName: string, data: string): boolean {
        const room = this.rooms.get(roomName);
        if (!room) {
            return false;
        }

        room.lastQrCode = data;
        room.lastTimestamp = Date.now();
        room.lastActivityTime = Date.now();
        logger.debug(`Room ${roomName} QR code updated`);
        return true;
    }

    /**
     * 增加房间接收者计数
     * @param roomName 房间名称
     * @returns 新的接收者数量，-1 表示房间不存在
     */
    addReceiver(roomName: string): number {
        const room = this.rooms.get(roomName);
        if (!room) {
            return -1;
        }

        room.receiverCount++;
        logger.debug(
            `Room ${roomName} receiver count increased to ${room.receiverCount}`,
        );
        return room.receiverCount;
    }

    /**
     * 减少房间接收者计数
     * @param roomName 房间名称
     * @returns 新的接收者数量，-1 表示房间不存在
     */
    removeReceiver(roomName: string): number {
        const room = this.rooms.get(roomName);
        if (!room) {
            return -1;
        }

        room.receiverCount = Math.max(0, room.receiverCount - 1);
        logger.debug(
            `Room ${roomName} receiver count decreased to ${room.receiverCount}`,
        );
        return room.receiverCount;
    }

    /**
     * 删除房间
     * @param roomName 房间名称
     * @returns 是否成功删除
     */
    deleteRoom(roomName: string): boolean {
        const result = this.rooms.delete(roomName);
        if (result) {
            logger.debug(`Room ${roomName} deleted`);
        }
        return result;
    }

    /**
     * 获取所有房间名称
     * @returns 房间名称数组
     */
    getAllRoomNames(): string[] {
        return Array.from(this.rooms.keys());
    }

    /**
     * 检查房间是否应该过期
     * 条件：无人监听 且 sender 无操作超过 5 分钟
     */
    private checkRoomExpiry(room: Room): boolean {
        if (room.receiverCount > 0) {
            return false;
        }

        const now = Date.now();
        const inactiveTime = now - room.lastActivityTime;
        return inactiveTime > ROOM_EXPIRY_TIME;
    }

    /**
     * 执行过期检查
     * @returns 过期的房间名称列表
     */
    private runExpiryCheck(): string[] {
        const expiredRooms: string[] = [];

        for (const [roomName, room] of this.rooms) {
            if (this.checkRoomExpiry(room)) {
                expiredRooms.push(roomName);
            }
        }

        for (const roomName of expiredRooms) {
            this.deleteRoom(roomName);
            logger.info(`Room ${roomName} expired and deleted`);
        }

        return expiredRooms;
    }

    /**
     * 启动过期检查定时器
     * @param onExpired 房间过期时的回调函数
     */
    startExpiryCheck(onExpired: (roomNames: string[]) => void): void {
        if (this.expiryCheckTimer) {
            logger.debug("Expiry check timer already running");
            return;
        }

        this.expiryCheckTimer = setInterval(() => {
            const expiredRooms = this.runExpiryCheck();
            if (expiredRooms.length > 0) {
                onExpired(expiredRooms);
            }
        }, EXPIRY_CHECK_INTERVAL);

        logger.info("Room expiry check started");
    }

    /**
     * 停止过期检查定时器
     */
    stopExpiryCheck(): void {
        if (this.expiryCheckTimer) {
            clearInterval(this.expiryCheckTimer);
            this.expiryCheckTimer = null;
            logger.info("Room expiry check stopped");
        }
    }
}

// 导出单例
export const roomManager = new RoomManager();
