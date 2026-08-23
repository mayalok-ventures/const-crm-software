import os from 'os';
import axios from 'axios';
import { Server } from './models/Server';

export class ServerHeartbeat {
  private intervalId: NodeJS.Timeout | null = null;
  private serverId: string;
  private applicationId: string;
  private environment: string;
  private agentVersion: string;
  private applicationVersion: string;
  private heartbeatIntervalMs: number;
  private heartbeatUrl: string;

  constructor() {
    this.serverId = process.env.SERVER_ID || os.hostname() || 'use-setu-server';
    this.applicationId = process.env.APPLICATION_ID || 'use-setu-crm';
    this.environment = process.env.NODE_ENV || 'development';
    this.agentVersion = '1.0.0';
    this.applicationVersion = process.env.APPLICATION_VERSION || '1.0.0';
    // Default heartbeat interval: 30s
    this.heartbeatIntervalMs = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10);
    this.heartbeatUrl =
      process.env.HEARTBEAT_URL || `http://127.0.0.1:${process.env.PORT || 5000}/api/monitoring/heartbeat`;
  }

  public start() {
    if (this.intervalId) return;

    console.log(
      `[ServerHeartbeat] Starting heartbeat worker for server "${this.serverId}" (Interval: ${this.heartbeatIntervalMs}ms)`
    );

    // Send first heartbeat after a 2-second delay to ensure backend is listening
    setTimeout(() => {
      this.sendHeartbeat().catch(err =>
        console.warn(`[ServerHeartbeat] Startup heartbeat warning (server starting up?): ${err.message}`)
      );
    }, 2000);

    // Setup interval
    this.intervalId = setInterval(() => {
      this.sendHeartbeat().catch(err => console.error('[ServerHeartbeat] Periodic heartbeat failed:', err.message));
    }, this.heartbeatIntervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`[ServerHeartbeat] Stopped heartbeat worker for server "${this.serverId}"`);
    }
  }

  private async sendHeartbeat() {
    let healthStatus = 'ONLINE';
    try {
      const server = (await Server.findOne({ serverId: this.serverId }).lean()) as any;
      if (server && server.healthScore !== undefined) {
        if (server.healthScore < 60) {
          healthStatus = 'DEGRADED';
        }
      }
    } catch (e) {
      healthStatus = 'DEGRADED';
    }

    const payload = {
      serverId: this.serverId,
      applicationId: this.applicationId,
      environment: this.environment,
      timestamp: new Date(),
      agentVersion: this.agentVersion,
      healthStatus,
      applicationVersion: this.applicationVersion,
    };

    // Send HTTP POST request
    await axios.post(this.heartbeatUrl, payload, { timeout: 5000 });
  }
}
export default ServerHeartbeat;
