"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramProvider = void 0;
const https_1 = __importDefault(require("https"));
class TelegramProvider {
    type = 'TELEGRAM';
    async send(channel, event) {
        const startTime = Date.now();
        const botToken = channel.config?.botToken;
        const chatId = channel.config?.chatId;
        if (!botToken || !chatId) {
            return {
                success: false,
                latencyMs: 0,
                error: 'Missing botToken or chatId in Telegram config',
            };
        }
        try {
            const alert = event.alert;
            const incident = event.incident;
            const severity = alert?.severity || incident?.severity || 'WARNING';
            const emoji = event.eventType === 'ALERT_RESOLVED'
                ? '🟢'
                : severity === 'CRITICAL'
                    ? '🚨'
                    : severity === 'WARNING'
                        ? '⚠️'
                        : 'ℹ️';
            const messageText = `
${emoji} *CRM ALERT ENGINE: ${event.eventType}*

*Severity:* ${severity}
*Title:* ${alert?.title || incident?.title || 'System Notification'}
*Metric:* \`${alert?.metricName || 'N/A'}\`
*Current Value:* \`${alert?.metricValue ?? 'N/A'}\` (${alert?.operator || '>'} \`${alert?.threshold ?? 'N/A'}\`)
*Time:* \`${new Date(event.timestamp).toISOString()}\`

_Mobile CRM Monitoring & Incident Management_
      `.trim();
            const telegramPayload = {
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown',
            };
            const payloadString = JSON.stringify(telegramPayload);
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadString).toString(),
                },
                timeout: 8000,
            };
            return await new Promise((resolve) => {
                const req = https_1.default.request(options, (res) => {
                    let body = '';
                    res.on('data', (c) => (body += c));
                    res.on('end', () => {
                        const latencyMs = Date.now() - startTime;
                        const statusCode = res.statusCode || 0;
                        const success = statusCode >= 200 && statusCode < 300;
                        resolve({
                            success,
                            statusCode,
                            responseBody: body.slice(0, 500),
                            latencyMs,
                            error: success ? undefined : `Telegram API Error ${statusCode}: ${body}`,
                        });
                    });
                });
                req.on('error', (err) => {
                    resolve({
                        success: false,
                        latencyMs: Date.now() - startTime,
                        error: `Telegram network error: ${err.message}`,
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        latencyMs: Date.now() - startTime,
                        error: 'Telegram API request timeout (8000ms)',
                    });
                });
                req.write(payloadString);
                req.end();
            });
        }
        catch (err) {
            return {
                success: false,
                latencyMs: Date.now() - startTime,
                error: `Telegram provider error: ${err.message}`,
            };
        }
    }
}
exports.TelegramProvider = TelegramProvider;
