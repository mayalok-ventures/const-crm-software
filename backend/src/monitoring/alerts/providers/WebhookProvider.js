"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
class WebhookProvider {
    type = 'WEBHOOK';
    async send(channel, event) {
        const startTime = Date.now();
        const urlString = channel.config?.webhookUrl;
        if (!urlString) {
            return {
                success: false,
                latencyMs: 0,
                error: 'Missing webhookUrl in channel config',
            };
        }
        try {
            const url = new url_1.URL(urlString);
            const payloadString = JSON.stringify(event);
            // Generate HMAC-SHA256 signature if secretKey provided
            const secret = channel.config?.secretKey || 'crm-alert-secret';
            const signature = crypto_1.default.createHmac('sha256', secret).update(payloadString).digest('hex');
            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadString).toString(),
                'X-Alert-Signature': `sha256=${signature}`,
                'X-Alert-Event': event.eventType,
                'User-Agent': 'MobileCRM-AlertEngine/1.0',
                ...(channel.config?.customHeaders || {}),
            };
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
                timeout: 8000,
            };
            const client = url.protocol === 'https:' ? https_1.default : http_1.default;
            return await new Promise((resolve) => {
                const req = client.request(options, (res) => {
                    let body = '';
                    res.on('data', (chunk) => {
                        body += chunk;
                    });
                    res.on('end', () => {
                        const latencyMs = Date.now() - startTime;
                        const statusCode = res.statusCode || 0;
                        const success = statusCode >= 200 && statusCode < 300;
                        resolve({
                            success,
                            statusCode,
                            responseBody: body.slice(0, 1000),
                            latencyMs,
                            error: success ? undefined : `HTTP Error ${statusCode}: ${body.slice(0, 200)}`,
                        });
                    });
                });
                req.on('error', (err) => {
                    resolve({
                        success: false,
                        latencyMs: Date.now() - startTime,
                        error: `Network error: ${err.message}`,
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        latencyMs: Date.now() - startTime,
                        error: 'Webhook request timed out (8000ms)',
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
                error: `Webhook delivery error: ${err.message}`,
            };
        }
    }
}
exports.WebhookProvider = WebhookProvider;
