import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue(), tailwindcss()],
    build: {
        outDir: path.resolve(__dirname, "../server/static"),
        emptyOutDir: true,
    },
    server: {
        https: {
            key: fs.readFileSync(
                path.resolve(__dirname, "../server/secrets/server.key"),
            ),
            cert: fs.readFileSync(
                path.resolve(__dirname, "../server/secrets/server.crt"),
            ),
        },
        host: true, // 允许局域网访问
        port: 5173, // 自定义端口
        proxy: {
            // 代理 socket.io 请求到后端
            "/socket.io": {
                target: "https://localhost:3000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
