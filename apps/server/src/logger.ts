import { argv } from "node:process";

const DEBUG = argv.includes("--debug");

const logger = {
    debug: (...args: unknown[]) => {
        if (DEBUG) {
            console.log(`[DEBUG] ${new Date().toISOString()}`, ...args);
        }
    },
    info: (...args: unknown[]) => {
        console.log(`[INFO] ${new Date().toISOString()}`, ...args);
    },
    error: (...args: unknown[]) => {
        console.error(`[ERROR] ${new Date().toISOString()}`, ...args);
    },
};

export default logger;
