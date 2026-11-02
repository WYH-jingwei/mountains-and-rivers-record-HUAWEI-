# 云部署配置方案

## 架构总览

```
用户 → ECS (Nginx + Node.js) → RDS (MySQL)
                           ↘ Redis (缓存)
                           ↘ OBS (地图HTML静态资源)
```

## 1. ECS 配置

### 规格
- 型号：ecs.g6.large（2核8G）或 ecs.g6.medium（1核4G）起步
- OS：Ubuntu 22.04 LTS
- 系统盘：40GB SSD
- 数据盘：100GB SSD（日志 + 应用）

### 部署内容
- Nginx：反向代理 + 静态文件服务
- Node.js 20 LTS：后端 API 服务（PM2 守护）
- 前端 dist：Nginx 直接服务静态文件

### Nginx 配置要点
```nginx
server {
  listen 80;
  server_name _;

  # 前端静态文件
  location / {
    root /opt/app/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # 地图 HTML（7.3MB，从 OBS 回源或本地服务）
  location /舆图山河录.html {
    root /opt/app/frontend/dist;
    # 如用 OBS：
    # proxy_pass https://obs.cn-north-4.myhuaweicloud.com/history-geo-map/舆图山河录.html;
    add_header Cache-Control "public, max-age=86400";
  }

  # API 反向代理
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### PM2 配置
```json
{
  "apps": [{
    "name": "history-geo-api",
    "script": "dist/index.js",
    "cwd": "/opt/app/server",
    "env": {
      "NODE_ENV": "production",
      "PORT": "3000",
      "DB_HOST": "<RDS内网地址>",
      "DB_PORT": "3306",
      "DB_USER": "history_geo",
      "DB_PASSWORD": "<从环境变量注入>",
      "REDIS_HOST": "<Redis内网地址>",
      "REDIS_PORT": "6379"
    },
    "max_memory_restart": "512M",
    "instances": 2,
    "exec_mode": "cluster"
  }]
}
```

## 2. RDS 配置

### 规格
- 版本：MySQL 8.0
- 规格：rds.mysql.n1.large.2（2核4G）或 rds.mysql.n1.medium.1 起步
- 存储：50GB SSD
- 网络：与 ECS 同 VPC，内网访问

### 数据库初始化
```bash
mysql -h <RDS地址> -u history_geo -p < sql/schema.sql
```

### 连接池配置（后端）
```typescript
// server/src/db/pool.ts
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'history_geo_classroom',
  connectionLimit: 10,
  charset: 'utf8mb4',
});
```

## 3. Redis 配置

### 规格
- 版本：**华为云 DCS for Redis**（客户端固定 RESP2，兼容 Redis 3.x/6.x 与 DCS）
- 规格：redis.ha.xu1.large.1（主备）或 redis.single.xu1.medium.1 起步
- 网络：与 ECS 同 VPC

### 用途
- QA 结果缓存（相同问题 5 分钟内命中缓存）
- 讲解包缓存（按朝代缓存，TTL 1 小时）
- Session/课堂会话（学生作答进度）

### 连接配置
```typescript
// server/src/db/redis.ts
import { createClient } from 'redis';

export const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redisClient.on('error', (err) => console.error('Redis:', err));
await redisClient.connect();
```

## 4. OBS 配置

### 桶规划
- 桶名：history-geo-map
- 区域：cn-north-4（与 ECS/RDS 同区域）
- 访问：公共读（地图 HTML 需公开访问）

### 存储内容
- `舆图山河录.html`（7.3MB 地图主文件）
- 前端 dist 静态资源（可选，如用 CDN 回源）

### 访问方式
- 方案 A（推荐）：ECS 本地服务地图文件，OBS 作为备份/版本管理
- 方案 B：Nginx proxy_pass 回源 OBS，ECS 不存大文件
- 方案 C：前端直接引用 OBS URL（需 CORS 配置）

### OBS CORS 配置（方案 C）
```json
{
  "AllowedOrigin": ["https://<ECS公网IP>", "http://localhost:5173"],
  "AllowedMethod": ["GET"],
  "AllowedHeader": ["*"],
  "ExposeHeader": ["ETag"]
}
```

## 5. 网络与安全

### VPC 规划
- VPC：192.168.0.0/16
- 子网1（ECS）：192.168.1.0/24
- 子网2（RDS）：192.168.2.0/24
- 子网3（Redis）：192.168.3.0/24

### 安全组规则
| 方向 | 端口 | 来源 | 用途 |
|------|------|------|------|
| 入 | 80 | 0.0.0.0/0 | HTTP |
| 入 | 443 | 0.0.0.0/0 | HTTPS（后续加证书） |
| 入 | 22 | <管理员IP> | SSH |
| 入 | 3306 | 192.168.1.0/24 | RDS（仅ECS子网） |
| 入 | 6379 | 192.168.1.0/24 | Redis（仅ECS子网） |

## 6. 部署步骤

1. 创建 VPC + 子网 + 安全组
2. 创建 RDS 实例 → 导入 schema.sql
3. 创建 Redis 实例
4. 创建 OBS 桶 → 上传地图 HTML
5. 创建 ECS → 安装 Node.js 20 + Nginx + PM2
6. CodeArts 流水线：构建 → 部署到 ECS
7. Nginx 配置 → PM2 启动后端
8. 验证：curl health → 访问前端页面 → 测试 API

## 7. CodeArts 流水线集成

```yaml
# .codearts/pipeline.yml
stages:
  - name: build
    steps:
      - run: cd frontend && npm ci && npm run build
      - run: cd server && npm ci && npx tsc
  - name: deploy
    steps:
      - scp: frontend/dist/* → /opt/app/frontend/dist/
      - scp: server/dist/* → /opt/app/server/dist/
      - ssh: pm2 reload history-geo-api
```