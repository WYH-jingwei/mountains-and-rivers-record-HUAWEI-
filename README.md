# 舆图山河录 · 三重疆域

> 华为 ICT 创新赛作品 · 历史疆域可信教学系统。
> 以**四档可信回应规则引擎**为灵魂，每条结论都挂**真实史料出处**，并通过地图的**三层叙事**（行政管辖 / 军事工程 / 人物行迹）区分「管到、写到、走到」，让 AI 只在有证据时作答、不替历史下结论。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript（`/map` 地图端、`/teach` 教师端、`/learn` 学生端）
- 后端：Express + TypeScript，规则引擎分级，LLM 仅润色、不产出事实
- 数据：MySQL 8（知识三表 + 课堂作答）、Redis（缓存）、BGE-M3 向量 + 混合检索
- 对话模型：openPangu-2.0-Flash；无模型配置时自动降级为关键词检索，全链路可用

## 目录结构

```
.
├── frontend/            # Vue3 前端（MapView/TeachView/LearnView）
│   └── public/          # 地图本体（iframe 内嵌）
├── server/              # Express 后端
│   ├── src/
│   │   ├── engine/      # 四档分级、朝代识别、偏差/讲解引擎
│   │   ├── rag/         # 向量检索、问题改写、答案生成
│   │   ├── data/        # 内置知识（降级用）与 DB 仓储
│   │   ├── db/          # MySQL / Redis 连接
│   │   └── routes/      # qa / lecture / deviation 路由
│   └── sql/             # schema 与种子数据
├── docs/                # 开发、部署、演示文档
└── README.md
```

## 一键启动

> 环境要求：Node.js ≥ 18（建议 22）、MySQL 8.x、Redis（可选，缺失自动降级）。

```powershell
# 1) 后端依赖与环境变量
cd server
npm install
Copy-Item .env.example .env       # 按需填写 DB 与 LLM 配置；.env 不会入库

# 2) 初始化数据库（建表 + 种子；无需 mysql 客户端）
npm run db:init

# 3) 启动服务（3001 端口，同时提供 API 与前端静态文件）
npm run serve
```

浏览器访问：

- 地图端：http://localhost:3001/map
- 教师端：http://localhost:3001/teach
- 学生端：http://localhost:3001/learn
- 健康检查：http://localhost:3001/api/health

> 前端独立开发：在 `frontend/` 下 `npm install && npm run dev`；生产构建 `npm run build`。

## 常用脚本（server/）

| 命令 | 作用 |
|---|---|
| `npm run serve` | 启动服务（tsx，3001，非 watch；改后端需重启） |
| `npm run verify` | 端到端自测（当前 20 项，跑完常驻） |
| `npm run build` | TypeScript 编译到 dist |
| `npm run db:init` | 执行 schema.sql + seed-data.sql 初始化数据库 |

## 验证标准

- 后端 `npm run verify`：**20 passed, 0 failed**，覆盖四档分级、讲解包、偏差画像
- 前端 `npm run build`：vue-tsc 类型检查 + 构建通过
- 当前数据规模：知识 49 条 / 出处 98 条 / 地图动作 48 条

## 四档可信回应

| 等级 | 名称 | 触发条件 |
|---|---|---|
| 1 | 直答 | 单一口径、有直接史料 |
| 2 | 条件答 | 同题多种管辖口径 |
| 3 | 范围声明 | 超出收录范围 / 史料不足 |
| 4 | 证据展示 | 学界无定论，只列证据、不画闭合边界 |

## 演示与文档

- 30 秒课堂演示脚本：[docs/demo-script.md](docs/demo-script.md)
- 本地开发与数据库接入：[docs/local-development.md](docs/local-development.md)
- 其余部署、流水线、协作文档见 [docs/](docs/)

## 安全说明

- 真实密钥仅放在 `server/.env`，已由 `.gitignore` 拦截，仓库中只保留 `.env.example` 模板
- 请勿将 `.env`、`*.key`、`*.pem` 提交入库；云端旧 API Key 的作废请在华为云控制台处理
