"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringRoutes = void 0;
const express_1 = __importDefault(require("express"));
const monitoringController_1 = require("../monitoring/controllers/monitoringController");
const router = express_1.default.Router();
// Ingestion endpoint for heartbeats (exempted from admin protection)
router.post('/heartbeat', monitoringController_1.handleHeartbeat);
exports.default = router;
exports.monitoringRoutes = router;
