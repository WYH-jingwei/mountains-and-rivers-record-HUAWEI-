# ECS 部署验证清单

## 部署前检查

- [ ] ECS 实例已创建，安全组开放 80/22 端口
- [ ] RDS 实例已创建，schema.sql 和 seed-data.sql 已导入
- [ ] Redis 实例已创建
- [ ] OBS 桶已创建（如使用 OBS 存地图）
- [ ] 前端 `npm run build` 产物已准备
- [ ] 后端 `npx tsc` 产物已准备

## 部署后验证

### 1. 基础服务
- [ ] `curl http://<ecs-ip>/api/health` 返回 `{"status":"ok"}`
- [ ] Nginx 正常服务前端页面
- [ ] PM2 进程状态为 online

### 2. 前端页面
- [ ] 访问 `http://<ecs-ip>/` 显示导航栏 + 地图端
- [ ] 访问 `http://<ecs-ip>/teach` 显示教师端
- [ ] 访问 `http://<ecs-ip>/learn` 显示学生端
- [ ] 地图 iframe 加载 `http://<ecs-ip>/舆图山河录.html` 正常显示

### 3. API 功能
- [ ] `POST /api/qa` body `{"question":"唐朝最西到哪？"}` 返回 Level 1 直答
- [ ] `POST /api/qa` body `{"question":"明朝疆域有多大？"}` 返回 Level 2 条件答
- [ ] `POST /api/lecture/export` body `{"dynasty":"tang"}` 返回讲解包
- [ ] `POST /api/deviation/answer` 记录作答成功
- [ ] `GET /api/deviation/class/demo-class` 返回偏差画像

### 4. Redis 缓存
- [ ] 重复提问相同问题，响应时间明显缩短
- [ ] Redis 中可查到 `qa:*` 和 `lecture:*` 缓存键

### 5. 地图联动
- [ ] 在地图端提问后点击"在地图上查看"，地图切换到对应朝代
- [ ] postMessage 消息被地图 HTML 正确接收

### 6. 离线降级
- [ ] 后端关闭时，前端地图仍可正常显示和操作
- [ ] API 请求失败时，前端有合理的错误提示

## 性能基线

| 指标 | 目标 |
|------|------|
| 首页加载 | < 3s（含 7.3MB 地图） |
| API 响应（首次） | < 200ms |
| API 响应（缓存命中） | < 50ms |
| 讲解包生成 | < 500ms |