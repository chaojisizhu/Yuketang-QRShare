import { io, type Socket } from "socket.io-client";
import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@qrshare/shared";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socket: TypedSocket = io({ autoConnect: true });

export default socket;
