#!/bin/bash
# =============================================================================
# Automated Production Deployment Script for AWS EC2 (Ubuntu 22.04 / 24.04 LTS)
# Domain: crm.coresetu.com | Node.js (5000) + Next.js (3000) + Nginx + SSL
# =============================================================================

set -e

DOMAIN="${1:-crm.coresetu.com}"
echo "🚀 Starting AWS EC2 Production Deployment for: $DOMAIN ..."

# 1. System Updates & Prerequisites
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw build-essential certbot python3-certbot-nginx

# 2. Install Node.js 20 LTS
echo "📦 Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install PM2 Process Manager globally
echo "📦 Installing PM2 globally..."
sudo npm install -g pm2

# 4. Configure Firewall (UFW)
echo "🔒 Configuring UFW Firewall..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# 5. Build Backend
echo "🔨 Installing Backend Dependencies..."
cd backend
npm install --production
cd ..

# 6. Build Frontend (Next.js)
echo "🔨 Building Frontend for https://$DOMAIN ..."
cd frontend
cat << EOF > .env.local
NEXT_PUBLIC_API_URL=https://$DOMAIN
EOF
npm install
npm run build
cd ..

# 7. Start/Restart Services with PM2
echo "⚡ Starting Services with PM2..."
cd backend
pm2 delete crm-backend 2>/dev/null || true
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    pm2 start server.js --name "crm-backend"
fi
cd ../frontend
pm2 delete crm-frontend 2>/dev/null || true
pm2 start npm --name "crm-frontend" -- start
cd ..

pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

# 8. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx Reverse Proxy for $DOMAIN ..."
sudo tee /etc/nginx/sites-available/mobile-crm > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50M;

    # Backend API & Webhooks
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend Next.js Web App
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/mobile-crm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 9. SSL Certificate Provisioning
echo "🔐 Attempting Let's Encrypt SSL Provisioning for $DOMAIN..."
if sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
    echo "✅ SSL Certificate successfully installed for https://$DOMAIN !"
else
    echo "⚠️ Certbot could not verify domain yet. Ensure your DNS A-Record for $DOMAIN points to this EC2 Elastic IP, then run:"
    echo "   sudo certbot --nginx -d $DOMAIN"
fi

echo "=================================================================="
echo "🎉 AWS EC2 DEPLOYMENT COMPLETE!"
echo "CRM URL: https://$DOMAIN"
echo "Backend API: https://$DOMAIN/api"
echo "=================================================================="
