#!/bin/bash
# ECS 部署脚本 — 在 ECS 实例上执行
# 前置条件：Ubuntu 22.04, 已开放 80/22 端口

set -e

echo "=== 1. 安装 Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 2. 安装 Nginx ==="
sudo apt-get install -y nginx

echo "=== 3. 安装 PM2 ==="
sudo npm install -g pm2

echo "=== 4. 创建应用目录 ==="
sudo mkdir -p /opt/app/frontend/dist
sudo mkdir -p /opt/app/server/dist
sudo mkdir -p /opt/app/server/sql
sudo chown -R $USER:$USER /opt/app

echo "=== 5. 部署前端 ==="
# 从 CodeArts 流水线产物或手动 scp 上传
# scp -r frontend/dist/* user@ecs:/opt/app/frontend/dist/

echo "=== 6. 部署后端 ==="
# scp -r server/dist/* user@ecs:/opt/app/server/dist/
# scp -r server/sql/* user@ecs:/opt/app/server/sql/
# scp server/package.json user@ecs:/opt/app/server/

cd /opt/app/server
npm install --production

echo "=== 7. 配置环境变量 ==="
cat > /opt/app/server/.env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DB_HOST=<RDS内网地址>
DB_PORT=3306
DB_USER=history_geo
DB_PASSWORD=<从华为云密钥管理服务注入>
DB_NAME=history_geo_classroom
REDIS_HOST=<Redis内网地址>
REDIS_PORT=6379
ENVEOF

echo "=== 8. 配置 Nginx ==="
sudo cat > /etc/nginx/sites-available/history-geo << 'NGINXEOF'
server {
  listen 80;
  server_name _;

  location / {
    root /opt/app/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  location /舆图山河录.html {
    root /opt/app/frontend/dist;
    add_header Cache-Control "public, max-age=86400";
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/history-geo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== 9. 启动后端 ==="
cd /opt/app/server
pm2 start dist/index.js --name history-geo-api --env production
pm2 save
pm2 startup

echo "=== 10. 健康检查 ==="
sleep 3
curl -sf http://localhost/api/health && echo " ✓ 服务正常" || echo " ✗ 服务异常"

echo "=== 部署完成 ==="