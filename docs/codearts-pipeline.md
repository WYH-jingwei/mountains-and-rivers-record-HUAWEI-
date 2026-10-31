# CodeArts 流水线配置

## 触发条件
- Push 到 main / develop 分支自动触发
- 支持手动触发

## 环境变量
| 变量 | 值 |
|------|-----|
| NODE_VERSION | 20 |
| SERVER_PORT | 3000 |

## 阶段1：代码检查 (lint)

| 步骤 | 命令 |
|------|------|
| 后端 TypeScript 类型检查 | `cd server && npm ci && npx tsc --noEmit` |
| 前端构建验证 | `cd frontend && npm ci && npm run build` |

## 阶段2：单元测试 (test)

依赖阶段1通过。

| 步骤 | 命令 |
|------|------|
| 端到端 API 测试 | `cd server && npx tsx src/test-e2e.ts` |

## 阶段3：构建产物 (build)

依赖阶段2通过。

| 步骤 | 命令 | 产物 |
|------|------|------|
| 前端打包 | `cd frontend && npm run build` | frontend/dist |
| 后端编译 | `cd server && npx tsc` | server/dist |

## 阶段4：部署到 ECS (deploy)

依赖阶段3通过，仅 main 分支触发。

| 步骤 | 类型 | 内容 |
|------|------|------|
| 上传前端 | scp | frontend/dist → /opt/app/frontend/dist |
| 上传后端 | scp | server/dist → /opt/app/server/dist |
| 重启 API | ssh | `pm2 reload history-geo-api && pm2 status` |
| 重载 Nginx | ssh | `nginx -s reload` |
| 健康检查 | ssh | `sleep 3 && curl -sf http://localhost/api/health` |

## CodeArts 项目配置

1. 在 CodeArts 中创建项目，绑定本仓库
2. 创建流水线，导入上述配置
3. 配置 ECS SSH 密钥（部署凭据）
4. 配置 RDS 连接信息（环境变量注入）
5. 设置通知：构建失败/部署成功时通知