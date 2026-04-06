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

    // 处理 sender 发送二维码
    socket.on("qrCode", (payload: QrCodePayload) => {
        const { username, role, data } = payload;

        // 验证角色
        if (role !== "sender") {
            logger.debug(`Non-sender attempted to send QR code: ${username}`);
            return;
        }

        // 获取或创建房间
        let room = roomManager.getRoom(username);
        const isNewRoom = !room;

        if (isNewRoom) {
            room = roomManager.createRoom(username);
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

            // 检查房间是否存在
            const room = roomManager.getRoom(roomName);
            if (!room) {
                logger.debug(`Room ${roomName} does not exist`);
                callback({ data: null, timestamp: null });
                return;
            }

            // 加入 Socket.IO 房间
            socket.join(roomName);

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

        // 检查房间是否存在
        const room = roomManager.getRoom(roomName);
        if (!room) {
            logger.debug(`Room ${roomName} does not exist, cannot leave`);
            return;
        }

        // 离开 Socket.IO 房间
        socket.leave(roomName);

        // 减少接收者计数
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
        // 注意：不需要特殊处理，房间会通过过期机制自动清理
    });
});

// 启动服务器
const port = argv[2] ? parseInt(argv[2]) : 3000;

httpsServer.listen(port, () => {
    logger.info(`Server running at https://localhost:${port}`);
});
