// 用户角色类型
export type Role = "sender" | "receiver";

// 基础用户信息
export interface UserPayload {
    username: string;
    role: Role;
}

// Sender 发送二维码的 payload
export interface QrCodePayload extends UserPayload {
    data: string;
}

// Receiver 加入房间的 payload
export interface JoinRoomPayload extends UserPayload {
    roomName: string;
}

// Receiver 离开房间的 payload
export interface LeaveRoomPayload extends UserPayload {
    roomName: string;
}

// Receiver 获取房间列表的 payload
export interface GetRoomsPayload extends UserPayload {}

// 房间数据（返回给 receiver）
export interface RoomData {
    data: string | null;
    timestamp: number | null;
}

// 新二维码通知
export interface NewQrcodePayload {
    roomName: string;
    data: string;
    timestamp: number;
}

// 新房间通知
export interface NewRoomPayload {
    roomName: string;
}

// 房间删除通知
export interface RoomDropPayload {
    roomName: string;
}

// 房间列表响应
export interface RoomsListResponse {
    rooms: string[];
}

// Socket 事件类型定义 - 客户端发送到服务端
export interface ClientToServerEvents {
    qrCode: (payload: QrCodePayload) => void;
    joinRoom: (
        payload: JoinRoomPayload,
        callback: (res: RoomData) => void,
    ) => void;
    leaveRoom: (payload: LeaveRoomPayload) => void;
    getRooms: (
        payload: GetRoomsPayload,
        callback: (res: RoomsListResponse) => void,
    ) => void;
}

// Socket 事件类型定义 - 服务端发送到客户端
export interface ServerToClientEvents {
    newQrcode: (payload: NewQrcodePayload) => void;
    newRoom: (payload: NewRoomPayload) => void;
    roomDrop: (payload: RoomDropPayload) => void;
}

// 房间内部数据结构（服务端使用）
export interface Room {
    name: string;
    senderName: string;
    lastQrCode: string | null;
    lastTimestamp: number | null;
    lastActivityTime: number;
    receiverCount: number;
}
