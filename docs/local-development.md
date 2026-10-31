# 本地开发与数据库接入说明

> 范围：本地开发环境下 MySQL / Redis 的接入、初始化与降级。**不涉及云上部署**（部署待审查通过后进行）。
> 已核实本机环境：Node v22.23.2、npm 10.9.8、Git 2.35；MySQL 8.4 监听 3306；Redis 3.0.504 监听 6379。

## 一、环境变量

复制样例并按需填写：

```powershell
Copy-Item server/.env.example server/.env
```

| 变量 | 说明 | 默认 |
|---|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL 连接（华为云 RDS 或本地 8.4） | 127.0.0.1:3306 / root / 空密码 / history_geo_classroom |
| `REDIS_HOST/PORT` 或 `REDIS_URL` | Redis 连接；二选一，URL 优先 | 127.0.0.1:6379 |
| `LLM_*` | 第三步使用，留空即降级 | 空 |

`.env` 已被 `.gitignore` 拦截，不会入库。启动脚本通过 `--env-file-if-exists=.env` 加载，文件缺失也不报错。

## 二、Redis（缓存）

- 本机为 **Redis 3.0.504**（Windows 老版，不支持 Redis 6 的 `HELLO`/RESP3 协商）。客户端固定使用 **RESP2**，可同时兼容老版本、新版 Redis 与华为云 DCS。
- 用途：QA 结果缓存（TTL 300s）、讲解包缓存（TTL 3600s）。
- 验证：相同问题重复提问，第二次命中缓存；`redis-cli KEYS "qa:*"` 可查到键。
- 降级：Redis 不可用时自动跳过缓存，功能与结果不受影响（启动日志 `Redis unavailable`）。

## 三、MySQL（结构化数据）

### 初始化（二选一）

```powershell
# 方式 A：通过 Node 脚本执行 schema + seed（无需 mysql 客户端）
cd server
npm run db:init

# 方式 B：用 mysql 客户端
mysql -h 127.0.0.1 -u root -p < sql/schema.sql
mysql -h 127.0.0.1 -u root -p < sql/seed-data.sql
```

`schema.sql` 建库 `history_geo_classroom` 与 10 张表；`seed-data.sql` 写入 20 条知识、出处、地图动作及偏差映射。

### 数据流向

- **问答**：数据库可用时，从 `knowledge_entries` + `evidence` + `map_actions` 组装条目；不可用时降级到内置 `knowledge.ts`。两条路径共用同一套关键词打分与四档规则分级。
- **作答**：`recordAnswerAsync` 始终写内存（保证降级可用），数据库可用时额外幂等写入 `classes`/`students`/`answer_records`；接口返回 `persisted` 标志表明是否落库。
- **画像**：数据库可用时从 `answer_records` 聚合（权威），否则用内存数据聚合。

### 降级

数据库未配置、凭据错误或库不存在时，启动日志打印 `MySQL unavailable (...)`，全部功能自动回退到内存实现，不影响演示。

## 四、启动与自测

```powershell
cd server
npm install
npm run serve     # 3001 端口，同时提供 API 与前端静态文件（含地图）
npm run verify   # 启动并执行端到端自测（当前 20 项）
npm run build    # TypeScript 编译到 dist
```

启动后：首页 `/`（地图端）、`/teach`（教师端）、`/learn`（学生端）、`/api/health`。

## 五、当前验证结果

- TypeScript 类型检查与构建：通过。
- 端到端自测：20/20 通过。
- Redis：连接成功，缓存写入与命中验证通过。
- MySQL：连接层与降级逻辑已验证；**待提供本机 root 密码后执行真实初始化与读写联调**。
