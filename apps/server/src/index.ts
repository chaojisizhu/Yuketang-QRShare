import express from "express";
import { createServer } from "https";
import { Server } from "socket.io";
import fs from "node:fs";
import { argv } from "node:process";
import logger from "./logger.js";
import { roomManager } from "./roomManager.js";
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    CreateRoomPayload,
    QrCodePayload,
    JoinRoomPayload,
    LeaveRoomPayload,
    GetRoomsPayload,
} from "@qrshare/shared";

// HTTPS 证书配置
const options = {
    key: fs.readFileSync("./secrets/server.key"),
    cert: fs.readFileSync("./secrets/server.crt"),
};

const app = express();
const httpsServer = createServer(options, app);

// Socket.IO 服务器配置
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpsServer, {
    connectTimeout: 2000,
    pingTimeout: 5000,
    pingInterval: 10000,
});

app.use(express.static("./static"));

// 启动房间过期检查
roomManager.startExpiryCheck((expiredRoomNames) => {
    // 通知所有 receiver 房间已删除
    for (const roomName of expiredRoomNames) {
        io.emit("roomDrop", { roomName });
        logger.info(`Room ${roomName} expired, notified all clients`);
    }
});

// 处理连接
io.on("connection", (socket) => {
    logger.debug(`Client connected: ${socket.id}`);

    // 记录该 socket 加入过的房间，用于断开时清理接收者计数
    const joinedRooms = new Set<string>();

    // 处理 sender 创建房间
    socket.on(
        "createRoom",
        (payload: CreateRoomPayload, callback: (res: { success: boolean }) => void) => {
            const { username, role } = payload;

            // 验证角色
            if (role !== "sender") {
                logger.debug(`Non-sender attempted to create room: ${username}`);
                callback({ success: false });
                return;
            }

            const existed = roomManager.getRoom(username) !== undefined;
            roomManager.createRoom(username, socket.id);

            // 新房间（或发送者重连接管）时通知所有 receiver
            if (!existed) {
                io.emit("newRoom", { roomName: username });
                logger.info(`New room created: ${username}`);
            }

            callback({ success: true });
        },
    );

    // 处理 sender 发送二维码
    socket.on("qrCode", (payload: QrCodePayload) => {
        const { username, role, data } = payload;

        // 验证角色
        if (role !== "sender") {
            logger.debug(`Non-sender attempted to send QR code: ${username}`);
            return;
        }

        // 获取或创建房间（兼容未先创建房间的老客户端）
        let room = roomManager.getRoom(username);
        const isNewRoom = !room;

        if (isNewRoom) {
            room = roomManager.createRoom(username, socket.id);
            // 通知所有 receiver 有新房间
            io.emit("newRoom", { roomName: username });
            logger.debug(`New room created: ${username}`);
        }

        // 设置二维码数据
        roomManager.setQrCode(username, data);

        // 向房间内的所有 receiver 发送二维码
        io.to(username).emit("newQrcode", {
            roomName: username,
            data,
            timestamp: Date.now(),
        });

        logger.debug(`QR code sent to room ${username}`);
    });

    // 处理 receiver 加入房间
    socket.on(
        "joinRoom",
        (
            payload: JoinRoomPayload,
            callback: (res: {
                data: string | null;
                timestamp: number | null;
            }) => void,
        ) => {
            const { username, role, roomName } = payload;

            // 验证角色
            if (role !== "receiver") {
                logger.debug(
                    `Non-receiver attempted to join room: ${username}`,
                );
                callback({ data: null, timestamp: null });
                return;
            }

            const room = roomManager.getRoom(roomName);

            // 加入 Socket.IO 房间（即使房间尚不存在，receiver 也可以先进去等待发送者）
            socket.join(roomName);
            joinedRooms.add(roomName);

            if (!room) {
                logger.debug(
                    `Receiver ${username} waiting in not-yet-created room ${roomName}`,
                );
                callback({ data: null, timestamp: null });
                return;
            }

            // 增加接收者计数
            roomManager.addReceiver(roomName);

            // 返回房间数据
            callback({
                data: room.lastQrCode,
                timestamp: room.lastTimestamp,
            });

            logger.debug(`Receiver ${username} joined room ${roomName}`);
        },
    );

    // 处理 receiver 离开房间
    socket.on("leaveRoom", (payload: LeaveRoomPayload) => {
        const { username, role, roomName } = payload;

        // 验证角色
        if (role !== "receiver") {
            logger.debug(`Non-receiver attempted to leave room: ${username}`);
            return;
        }

        // 离开 Socket.IO 房间
        socket.leave(roomName);
        joinedRooms.delete(roomName);

        // 房间可能已不存在（发送者离开后被关闭），计数清理尽量执行
        roomManager.removeReceiver(roomName);

        logger.debug(`Receiver ${username} left room ${roomName}`);
    });

    // 处理获取房间列表
    socket.on(
        "getRooms",
        (
            payload: GetRoomsPayload,
            callback: (res: { rooms: string[] }) => void,
        ) => {
            const { username, role } = payload;

            // 验证角色
            if (role !== "receiver") {
                logger.debug(
                    `Non-receiver attempted to get rooms: ${username}`,
                );
                callback({ rooms: [] });
                return;
            }

            const rooms = roomManager.getAllRoomNames();
            callback({ rooms });

            logger.debug(
                `Receiver ${username} requested room list: ${rooms.length} rooms`,
            );
        },
    );

    // 处理断开连接
    socket.on("disconnect", () => {
        logger.debug(`Client disconnected: ${socket.id}`);

        // 发送者断开：关闭其房间，通知所有客户端
        const closedRooms = roomManager.closeRoomsBySenderSocket(socket.id);
        for (const roomName of closedRooms) {
            io.emit("roomDrop", { roomName });
        }

        // 清理断开时仍留在房间里的接收者计数
        for (const roomName of joinedRooms) {
            roomManager.removeReceiver(roomName);
        }
        joinedRooms.clear();
    });
});

// 启动服务器
const port = argv[2] ? parseInt(argv[2]) : 3000;

httpsServer.listen(port, () => {
    logger.info(`Server running at https://localhost:${port}`);
});
