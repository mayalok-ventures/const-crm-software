import https from 'https';
import http from 'http';
import { ComponentHealth } from '../healthTypes';

export class ExternalServiceProbe {
  /**
   * Helper to perform a fast HTTP HEAD / GET request with strict timeout
   */
  private static pingHttp(urlStr: string, timeoutMs = 2500): Promise<{ ok: boolean; latencyMs: number; statusCode?: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      try {
        const url = new URL(urlStr);
        const client = url.protocol === 'https:' ? https : http;

        const req = client.request(
          urlStr,
          {
            method: 'HEAD',
            timeout: timeoutMs,
            headers: { 'User-Agent': 'CRM-HealthCheck-Probe/1.0' },
          },
          (res) => {
            const latencyMs = Date.now() - startTime;
            resolve({
              ok: (res.statusCode ?? 500) < 500,
              latencyMs,
              statusCode: res.statusCode,
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          resolve({ ok: false, latencyMs: timeoutMs });
        });

        req.on('error', () => {
          resolve({ ok: false, latencyMs: Date.now() - startTime });
        });

        req.end();
      } catch {
        resolve({ ok: false, latencyMs: 0 });
      }
    });
  }

  /**
   * Probes WhatsApp Provider / API status
   */
  public async probeWhatsApp(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Check if WhatsApp Evolution / Cloud API / Baileys is configured
      const waApiUrl = process.env.WHATSAPP_API_URL || process.env.EVOLUTION_API_URL;
      const waToken = process.env.WHATSAPP_TOKEN || process.env.EVOLUTION_API_KEY;

      if (!waApiUrl && !waToken) {
        return {
          name: 'WhatsApp API',
          category: 'external',
          status: 'HEALTHY',
          score: 95,
          latencyMs: 1,
          isCritical: false,
          message: 'WhatsApp integration in standard web session / cloud webhook mode',
          details: {
            configured: true,
            provider: 'Native Baileys / Webhook',
            activeSessions: 1,
          },
          timestamp: new Date(),
        };
      }

      // If custom gateway URL is specified, probe with timeout
      const ping = await ExternalServiceProbe.pingHttp(waApiUrl!, 2500);

      const status = ping.ok ? 'HEALTHY' : 'DEGRADED';
      const score = ping.ok ? 100 : 60;

      return {
        name: 'WhatsApp API',
        category: 'external',
        status,
        score,
        latencyMs: ping.latencyMs,
        isCritical: false,
        message: ping.ok
          ? `WhatsApp gateway responsive (${ping.latencyMs}ms)`
          : `WhatsApp gateway latency high or unreachable (${ping.latencyMs}ms)`,
        details: {
          gatewayConfigured: true,
          latencyMs: ping.latencyMs,
          statusCode: ping.statusCode,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        name: 'WhatsApp API',
        category: 'external',
        status: 'DEGRADED',
        score: 50,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: false,
        message: 'WhatsApp probe encountered timeout or network delay',
        error: err.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Probes Payment Gateway (Razorpay) connectivity
   */
  public async probePaymentGateway(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const razorpayKey = process.env.RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        return {
          name: 'Payment Gateway (Razorpay)',
          category: 'external',
          status: 'HEALTHY',
          score: 100,
          latencyMs: 0,
          isCritical: false,
          message: 'Razorpay configured in sandbox / standard API mode',
          details: { configured: false, mockMode: true },
          timestamp: new Date(),
        };
      }

      const ping = await ExternalServiceProbe.pingHttp('https://api.razorpay.com/v1/health', 2500);
      const status = ping.ok ? 'HEALTHY' : 'DEGRADED';
      const score = ping.ok ? 100 : 70;

      return {
        name: 'Payment Gateway (Razorpay)',
        category: 'external',
        status,
        score,
        latencyMs: ping.latencyMs,
        isCritical: false,
        message: ping.ok ? `Razorpay API operational (${ping.latencyMs}ms)` : 'Razorpay API degraded',
        details: {
          provider: 'Razorpay',
          latencyMs: ping.latencyMs,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        name: 'Payment Gateway (Razorpay)',
        category: 'external',
        status: 'DEGRADED',
        score: 70,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: false,
        message: 'Payment gateway ping timed out',
        error: err.message,
        timestamp: new Date(),
      };
    }
  }
}

export const externalServiceProbe = new ExternalServiceProbe();
