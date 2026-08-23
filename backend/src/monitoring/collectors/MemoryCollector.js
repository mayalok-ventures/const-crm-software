"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCollector = void 0;
const os_1 = __importDefault(require("os"));
class MemoryCollector {
    collect() {
        const totalBytes = os_1.default.totalmem();
        const freeBytes = os_1.default.freemem();
        const usedBytes = totalBytes - freeBytes;
        const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
        return {
            totalBytes,
            usedBytes,
            freeBytes,
            usagePercent: parseFloat(usagePercent.toFixed(2)),
        };
    }
}
exports.MemoryCollector = MemoryCollector;
