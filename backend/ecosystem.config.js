/**
 * PM2 Ecosystem Configuration for Production (api.sahyak.com / EC2 Stockholm)
 *
 * ARCHITECTURAL DESIGN:
 * 1. crm-api:
 *    - Dedicated HTTP Express API server.
 *    - RUN_BACKGROUND_WORKERS=false isolates the API event loop from heavy background CPU jobs.
 *    - Mode: 'fork' (1 instance).
 *      NOTE ON CLUSTER MODE: Keep fork mode (1 instance). In-memory authCache (5-min TTL)
 *      and lead countCache (30-sec TTL) are currently process-local (no Redis pub/sub).
 *      Running multiple cluster instances without Redis causes cache inconsistency
 *      (e.g., role change / count invalidate on instance A wouldn't invalidate instance B).
 *
 * 2. crm-worker:
 *    - Dedicated background process running crons, campaign send loops, telemetry probes,
 *      and Google Sheets sync sweeps.
 *    - Operates out-of-band so background work never blocks HTTP request handling.
 */

module.exports = {
  apps: [
    {
      name: 'crm-api',
      script: 'server.js',
      cwd: '/home/ubuntu/crm/backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1536',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        RUN_BACKGROUND_WORKERS: 'false',
        PERF_DEBUG: '0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        RUN_BACKGROUND_WORKERS: 'false',
        PERF_DEBUG: '0',
      },
      error_file: '/home/ubuntu/.pm2/logs/crm-api-error.log',
      out_file: '/home/ubuntu/.pm2/logs/crm-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 8000,
    },
    {
      name: 'crm-worker',
      script: 'src/workers/backgroundWorker.js',
      cwd: '/home/ubuntu/crm/backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1536',
      env: {
        NODE_ENV: 'production',
        RUN_BACKGROUND_WORKERS: 'true',
        PERF_DEBUG: '0',
      },
      env_production: {
        NODE_ENV: 'production',
        RUN_BACKGROUND_WORKERS: 'true',
        PERF_DEBUG: '0',
      },
      error_file: '/home/ubuntu/.pm2/logs/crm-worker-error.log',
      out_file: '/home/ubuntu/.pm2/logs/crm-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 15000,
    },
  ],
};
