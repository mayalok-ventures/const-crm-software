#!/bin/bash
set -eo pipefail

echo "=========================================================="
echo "🚀 [Deploy] Starting SAHYAK CRM Backend Deployment on EC2"
echo "=========================================================="

cd /home/ubuntu/mobile-crm

PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
echo "📌 [Git] Previous commit: ${PREVIOUS_COMMIT}"

echo "📥 [Git] Fetching latest main branch from origin..."
git fetch origin main

TARGET_COMMIT=$(git rev-parse origin/main)
echo "🎯 [Git] Target commit to deploy: ${TARGET_COMMIT}"

echo "🔄 [Git] Checking out target commit ${TARGET_COMMIT}..."
git checkout -f main
git reset --hard origin/main

CURRENT_COMMIT=$(git rev-parse HEAD)
echo "✅ [Git] Working tree synchronized at commit: ${CURRENT_COMMIT}"

# Function to poll liveness endpoint
# Polls every 2 seconds for up to 120 seconds (60 attempts)
# Returns 0 on HTTP 200, 1 on timeout
poll_health() {
  local max_attempts=60
  local interval=2
  local attempt=1
  local endpoint="http://127.0.0.1:5000/api/health/live"

  echo "🔍 [Health] Polling liveness probe at ${endpoint} (max ${max_attempts} attempts, every ${interval}s)..."

  while [ "$attempt" -le "$max_attempts" ]; do
    local http_code
    http_code=$(curl -s -m 5 --connect-timeout 3 -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
      echo "✅ [Health] Liveness probe returned HTTP 200 on attempt ${attempt}/${max_attempts}!"
      return 0
    else
      echo "⏳ [Health] Attempt ${attempt}/${max_attempts}: HTTP ${http_code} - waiting ${interval}s..."
      sleep "$interval"
      attempt=$((attempt + 1))
    fi
  done

  echo "❌ [Health] Liveness probe timed out after $((max_attempts * interval)) seconds without receiving HTTP 200."
  return 1
}

# 5. Install production dependencies for backend
echo "📦 [NPM] Installing backend production dependencies..."
cd /home/ubuntu/mobile-crm/backend
npm ci --omit=dev

# 6. Graceful reload of PM2 process with bounded readiness verification
echo "⚡ [PM2] Reloading crm-backend with ecosystem configuration..."
if [ -f "ecosystem.config.js" ]; then
  pm2 reload ecosystem.config.js --update-env || pm2 reload crm-backend --update-env || pm2 start ecosystem.config.js
else
  pm2 reload crm-backend --update-env || pm2 start server.js --name "crm-backend"
fi
pm2 save
sleep 3

# 7. Bounded health polling for the target deployment
if poll_health; then
  echo "=========================================================="
  echo "🎉 [Deploy] SUCCESS: Commit ${TARGET_COMMIT} successfully deployed and healthy!"
  echo "=========================================================="
  exit 0
else
  echo "=========================================================="
  echo "🚨 [Deploy] FAILURE: Health verification failed for target commit ${TARGET_COMMIT}"
  echo "=========================================================="
  echo "=== PM2 Process Status ==="
  pm2 status || true
  echo "=== Recent PM2 Process Logs ==="
  pm2 logs crm-backend --lines 50 --nostream || true

  # 8. Automated Rollback to PREVIOUS_COMMIT
  if [ -n "$PREVIOUS_COMMIT" ] && [ "$PREVIOUS_COMMIT" != "$TARGET_COMMIT" ]; then
    echo "=========================================================="
    echo "🔄 [Rollback] Initiating automatic rollback to previous commit: ${PREVIOUS_COMMIT}"
    echo "=========================================================="

    cd /home/ubuntu/mobile-crm
    git checkout -f "$PREVIOUS_COMMIT"

    cd /home/ubuntu/mobile-crm/backend
    echo "📦 [Rollback] Restoring dependencies for ${PREVIOUS_COMMIT}..."
    npm ci --omit=dev

    echo "⚡ [Rollback] Reloading PM2 process on previous commit..."
    if [ -f "ecosystem.config.js" ]; then
      pm2 reload ecosystem.config.js --update-env || pm2 reload crm-backend --update-env || pm2 start ecosystem.config.js
    else
      pm2 reload crm-backend --update-env || pm2 start server.js --name "crm-backend"
    fi
    pm2 save
    sleep 3

    echo "🔍 [Rollback] Verifying health of rolled-back commit ${PREVIOUS_COMMIT}..."
    if poll_health; then
      echo "=========================================================="
      echo "✅ [Rollback] AUTOMATIC ROLLBACK SUCCESSFUL!"
      echo "Production has been restored to previous known-good commit: ${PREVIOUS_COMMIT}"
      echo "Deployment of ${TARGET_COMMIT} is marked as FAILED."
      echo "=========================================================="
      exit 1
    else
      echo "=========================================================="
      echo "💥 [Rollback] CRITICAL ROLLBACK FAILURE!"
      echo "Failed to restore health on previous commit ${PREVIOUS_COMMIT} as well."
      echo "=== Rollback PM2 Logs ==="
      pm2 logs crm-backend --lines 50 --nostream || true
      echo "=========================================================="
      exit 1
    fi
  else
    echo "⚠️ [Rollback] No distinct previous commit available to roll back to (${PREVIOUS_COMMIT})."
    exit 1
  fi
fi
