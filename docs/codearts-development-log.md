# CodeArts 开发留痕文档

> 本文档记录"舆图山河录 · AI 历史地理课堂"应用从需求分析到代码实现的完整开发过程，作为华为 ICT 大赛创新赛赛题1（CodeArts 代码智能体必选）的评分材料。

## 1. 项目概述

**作品名称**：舆图山河录 · AI 历史地理课堂  
**赛题绑定**：赛题1 — 基于华为云产品打造 AI 创新应用  
**核心概念**：三重疆域（管到的 / 写到的 / 走到的）— 用同一张地图回答"唐朝到底有多大"  

**技术栈**：
- 前端：Vue 3 + Vite + TypeScript + vue-router + axios
- 后端：Node.js + Express + TypeScript
- 数据库：MySQL 8.0（华为云 RDS）
- 缓存：Redis（华为云）
- 静态资源：OBS（华为云）
- 开发工具：CodeArts（华为云代码智能体）

## 2. 开发过程记录

### 2.1 需求分析与方案设计

**输入**：已有作品《舆图山河录》——单文件 7.3MB Canvas 历史地图，含 22 个朝代切片、90 个人物、10 条路线、66,927 个顶点。

**分析**：
- 原作品是纯前端可视化，无后端、无数据库、无 AI 交互
- 赛题1 要求基于华为云产品打造 AI 创新应用，CodeArts 必选
- 改造方向：将"只看地图"升级为"能问能答的 AI 课堂"

**决策**：
- 采用"三端一体"架构：地图端（问答）+ 教师端（备课）+ 学生端（测验）
- 核心创新：四档回应机制（直答/条件答/范围声明/证据展示）— 规则引擎而非自由 AI
- 认知偏差画像：按三重疆域概念归因学生错误

**产出文档**：
- `华为ICT创新赛_赛道对标与改造方案.md`（V3 完整能力版）

### 2.2 项目脚手架搭建

**操作**：使用 CodeArts 创建项目结构

```
mountains-and-rivers-record(HUAWEI)/
├── server/          # 后端 API
│   ├── src/
│   │   ├── engine/  # 核心引擎（grader, lecture, deviation）
│   │   ├── data/    # 知识库数据
│   │   ├── routes/  # API 路由
│   │   └── index.ts # Express 入口
│   ├── sql/         # RDS schema
│   └── package.json
├── frontend/        # 前端 Vue 应用
│   ├── src/
│   │   ├── api/     # API 客户端
│   │   ├── views/   # 三个页面组件
│   │   ├── router/  # 路由配置
│   │   └── main.ts  # 入口
│   ├── public/      # 地图 HTML
│   └── package.json
├── docs/            # 部署与设计文档
└── 舆图山河录.html   # 原始作品
```

### 2.3 后端核心引擎开发

#### 2.3.1 四档分级规则引擎（grader.ts）

**设计思路**：不依赖 AI 模型自由判断，而是用确定性规则引擎根据证据数量、口径冲突、年代越界三个维度判定回应档位。

**实现**：
- Level 1（直答）：单一口径、证据充分 → 直接给答案
- Level 2（条件答）：多口径并存 → 标注条件再给答案
- Level 3（范围声明）：超出系统收录范围 → 声明边界
- Level 4（证据展示）：无共识争议 → 展示各方证据

**测试验证**：
- "唐朝最西到哪？" → Level 1 直答 ✓
- "明朝疆域有多大？" → Level 2 条件答 ✓

#### 2.3.2 知识库数据（knowledge.ts）

**设计思路**：每条知识条目必须包含真实史料出处，不允许无证据的断言。

**数据规模**：
- 唐朝 10 条：涵盖安西四镇、羁縻体系、玄奘行迹、渤海与新罗等
- 明朝 10 条：涵盖直辖布政使司、羁縻卫所、郑和下西洋、北界无闭合等
- 每条含 2-3 个出处（旧唐书、新唐书、明史、明实录等）

**关键字搜索**：支持关键词匹配检索，如"最西"→"唐朝最西到哪？"

#### 2.3.3 讲解包生成器（lecture.ts）

**功能**：教师选择朝代 → 自动生成讲解包（地图切片 + 课堂问题 + 出处卡片）

**实现**：
- 地图切片：从知识条目中提取 mapAction（朝代/年份/图层/焦点坐标）
- 课堂问题：每条知识生成 4 选项选择题，干扰项按三重疆域混淆模式设计
- 出处卡片：汇总所有证据，标注置信度

**测试验证**：唐朝 → 9 个地图切片、5 个课堂问题 ✓

#### 2.3.4 认知偏差画像（deviation.ts）

**设计思路**：学生答错不是随机错误，而是系统性的概念混淆。按三重疆域归因：
- 管到/写到混淆：把羁縻当成直辖
- 走到/管到混淆：把行迹当成管辖
- 写到/管到混淆：把文献记载当成实际设治
- 范围超出：选了系统不存在的选项

**实现**：
- 作答记录 → 按 questionId 映射偏差类型 → 聚合统计 → 生成画像
- 教师端可查看班级画像：总作答数、学生数、偏差分布、教学建议

**测试验证**：3 条作答 → "管到/写到混淆"归因正确 ✓

### 2.4 API 路由开发

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/qa` | POST | 问答接口（输入问题 → 返回分级回应） |
| `/api/lecture/export` | POST | 讲解包导出（输入朝代 → 返回地图+问题+出处） |
| `/api/deviation/answer` | POST | 作答记录（学生提交答案） |
| `/api/deviation/class/:classId` | GET | 偏差画像查询（返回班级偏差统计） |
| `/api/health` | GET | 健康检查 |

### 2.5 前端开发

#### 2.5.1 路由架构

三路由对应三端：
- `/map` → MapView（地图端：iframe 地图 + 问答侧栏）
- `/teach` → TeachView（教师端：讲解包 + 偏差画像）
- `/learn` → LearnView（学生端：答题 + 认知标签）

#### 2.5.2 地图端（MapView.vue）

- iframe 嵌入 7.3MB 地图 HTML
- 问答侧栏：输入问题 → 显示分级回应 + 出处卡片 + 不确定项
- "在地图上查看"按钮：通过 postMessage 向 iframe 发送地图联动指令

#### 2.5.3 教师端（TeachView.vue）

- 朝代选择器（唐/明）
- 讲解包预览：地图切片列表、课堂问题（含选项和正确答案）、出处卡片网格
- 偏差画像：班级统计、偏差类型分布、教学建议

#### 2.5.4 学生端（LearnView.vue）

- 三阶段流程：intro（介绍）→ quiz（答题）→ result（结果）
- 认知标签：根据答题结果自动归因（管到/写到混淆等）
- 结果页引导：去地图端提问查看完整证据链

### 2.6 构建与测试验证

**前端构建**：`npm run build` → vue-tsc 类型检查 + vite 打包 → ✓ 成功（158KB JS gzip 59KB）

**后端端到端测试**：5 项全部通过
1. health ✓
2. qa-direct（直答） ✓
3. qa-conditional（条件答） ✓
4. lecture-tang（讲解包） ✓
5. deviation-record（偏差画像） ✓

### 2.7 数据库设计

**RDS Schema**（`server/sql/schema.sql`）：
- knowledge_entries：知识条目主表
- evidence：出处证据（一对多）
- map_actions：地图动作（一对一）
- deviation_type_map：问题→偏差类型映射
- deviation_suggestions：偏差类型→教学建议
- classes / students / answer_records：课堂与作答
- lecture_packages：讲解包缓存

### 2.8 云部署方案

**华为云产品组合**：
- ECS：Nginx + Node.js（API 服务）
- RDS for MySQL 8.0：知识库 + 作答记录
- Redis：QA 缓存 + 讲解包缓存 + 会话
- OBS：7.3MB 地图 HTML 静态资源

**部署文档**：`docs/cloud-deployment.md`

### 2.9 真实模型接入与 RAG 检索校准（本地联调，未部署）

**模型选型决策（成本优先，贴合学生预算）**：

| 用途 | 选定模型 | 选择理由 |
|---|---|---|
| 对话生成 | `openpangu-2.0-flash` | 本系统 LLM 职责极轻：短上下文、短输出、不参与分级，仅把规则结论润色为自然语言，无需旗舰推理；Flash 输入 0.80 / 输出 1.60（元/百万 token），按单次约输入 1200 / 输出 300 token 估算，2000 次约 ¥2.88；预留切换 `openpangu-2.0-pro` 注释 |
| 文本向量 | `bge-m3` | MaaS 预置服务、标准 OpenAI 兼容 `/embeddings` 端点、1024 维、中英文，免自部署 |

两者均为华为云 ModelArts Studio（MaaS）预置服务（区域 cn-southwest-2），共用一个 API Key；Key 仅写入本地 `server/.env`（已被 .gitignore 拦截，不入库）。

**架构原则（用户锁定口径，不可偏移）**：
- 语义检索只负责"找对材料"；**四档分级、出处卡、地图动作仍由规则引擎决定**，模型不参与分级。
- 降级链：embedding 未配置 / 调用失败 → 回退关键词检索；LLM 未配置 / 生成失败 → 保留规则引擎原 answer。

**新增/改动模块**：
- `server/src/llm/client.ts`：对话与向量双 base 地址、配置探测（`isLlmConfigured` / `isEmbeddingConfigured`）、仅用内置 fetch。
- `server/src/rag/vector-store.ts`：向量懒构建（缺失时批量 embedding 20 条）+ Redis 缓存 `rag:vectors:<model>`（TTL 86400）；余弦相似度排序。
- `server/src/rag/generator.ts`：系统提示四条约束（区分管到/写到/走到、不编造、分歧明示、输出 ≤200 字）；生成失败返回 null 走降级。
- `server/src/routes/qa.ts`：检索编排 + 多口径触发信号 + LLM 润色接线。

**校准过程（规则体 `grader.ts` 一行未改，只让上游触发信号更准）**：

1. **多口径误触发（level2 假阳性）**：语义召回比关键词更宽，把邻近主题（最北、行迹等）一并带入，使单口径直答被误判为条件答。统一检索返回 `RetrievalHit { entry, score }`，多口径（level2）收紧为同时满足：同朝代 + 口径不同 + 次条/头条分数比 ≥ 0.93 + 共享主题关键词（同族问题）。
2. **域外问题弱召回（level3 失效）**：初版余弦阈值 0.2 过低，宋/汉/元/清等域外问题被低相似条目强行召回。基于样本标定阈值 0.60：真实命中 top1 ≥ 0.69，域外朝代 ≤ 0.56，完全无关 ≤ 0.39，据此干净分离；关键词降级路径不受此阈值影响。
3. **坐标类型修复**：MySQL `DECIMAL` 经 mysql2 返回字符串，`mapAction.focus` 在 DB 组装层统一 `Number()` 转数值，保障后续地图定位使用数值坐标。

**关键用例前后对比**：

| 问题 | 修复前 | 修复后 | 说明 |
|---|---|---|---|
| 唐朝最西到哪？ | level2（误判多口径） | **level1** | 单一直辖口径直答 |
| 唐朝面积多少？ | level2 | **level2**（保留） | 直辖 944 万 vs 含羁縻 1237 万，真多口径 |
| 唐朝最北到哪？ | level2（误判） | **level1** | 羁縻单条 |
| 宋/汉疆域多大、无关问题 | level1（误答） | **level3** | 超范围声明边界 |
| 语义改写问（词面无关键词命中） | — | **level1 正确召回** | 验证向量泛化补关键词盲区 |

**验证结果**：`npm run verify` 自测套件 **20 passed / 0 failed**；真实联调下 Flash 自然语言改写生效，level / evidence / mapAction 仍来自规则引擎，focus 为数值类型；向量缓存命中后二次问答不再重复调用 embedding。

### 2.10 地图 postMessage 联动闭环（本地联调，未部署）

**目标**：问答侧栏点击"在地图上查看"后，由后端 `mapAction` 驱动地图端完成"切朝代 → 选时点 → 配图层 → 镜头飞行 / 行迹生长"的闭环；四档分级与地图动作的归属仍由规则引擎决定，本环节只负责动作落地。

**消息协议（前后端约定，保持不变）**：

```
MapAction { dynasty: 'tang'|'ming'; year?: number;
            layer: 'admin'|'military'|'journey'|'cultural';
            focus?: [lng, lat] }
```

**改动模块**：
- `frontend/public/舆图山河录.html`（地图内嵌脚本）：
  - 在主闭包 `window.__MAP` 内新增统一入口 `focusOnAction(action)`，可直达原闭包私有函数（`selectDynasty` / `selectPhase` / `showRoute` / `tweenTo` / 图层开关）；原先末尾一段依赖裸函数 `selectDynasty`、`tweenTo` 的监听器因二者在闭包外不可达而从未生效，本次整体替换。
  - 行为分支：`layer=journey` 时复用内置人物路线（唐→玄奘、明→郑和）调 `showRoute` 做逐站生长；其余分支先按 `dynasty` 切朝、`year` 选最近内部时点（phase）、补开对应图层（`admin` 行政面 / `military` 都护府军镇锚点 / `cultural` 文献地名），再按 `focus=[lng,lat]` 飞行定位（`view.cx/cy` 本身即经纬度，直接作为飞行中心）。各图层默认全开、**不做互斥隐藏**，保留"管到 / 写到 / 走到"三层同框。
  - 消息监听加同源 `origin` 校验，拒绝跨源消息。
- `frontend/src/views/MapView.vue`（发送侧）：`handleMapAction` 在 `postMessage` 前先 `JSON.parse(JSON.stringify(action))` 剥离响应式代理。

**关键缺陷修复——DataCloneError**：首版直接 `postMessage(response.mapAction, '*')`，而 `response.mapAction` 是 Vue 响应式 `Proxy` 对象，结构化克隆算法无法克隆 Proxy，控制台持续抛 `DataCloneError: [object Object] could not be cloned`，消息实际未发出、地图无响应。序列化为纯普通对象后消除，控制台零报错。

**端到端实测（真实提问 → 按钮 → 地图，CDP 主世界读 `__MAP.viewState()` / `current()`）**：

| 用例 | layer | 期望动作 | 实测结果 |
|---|---|---|---|
| 唐朝最西到哪？ | admin | 切唐、定位碎叶 | cur=13(唐)，cx=75.30 cy=42.80，s=16.00 ✅ |
| 安西四镇（唐·661） | military | 切唐、锚点层、定位 | cur=13(唐)，cx=83.00 cy=41.70，s=16.00 ✅ |
| 玄奘西行经过哪些地方？ | journey | 玄奘路线生长 | cur=13(唐)，routePts=7 站 ✅ |
| 郑和下西洋（明·1430） | journey | 切明、郑和路线生长 | cur=18(明)，routePts=6 站 ✅ |

**验证结果**：前端 `npm run build`（vue-tsc + vite）通过；四类图层分支均落地，真实点击无控制台错误；地图 `items=22` 加载正常。行迹镜头由既有 `routeView` 按整条路线叠加朝代疆域框统一取景，跨幅较大时接近全景属既有设计，不影响站点绘制与生长。

### 2.11 材料池扩充、hybrid 检索打磨、悬浮窗与响应式（本地联调，未部署）

#### （1）阶段0 审查收口
- 停掉后台服务后跑 `npm run verify`，基线 **20 passed / 0 failed**；通读后端 qa/grader/vector-store/generator/client/knowledge-repo 与前端三端，确认架构无硬伤。
- Git 工作区干净，`.env`、`dist`、`node_modules` 均未被跟踪。

#### （2）阶段1 扩池技术改造（1a）
- 地图 `focusOnAction`：把 `nameMap={tang:'唐',ming:'明'}` 替换为**全量 22 朝代拼音→中文 codeMap**，未命中再按原值 indexOf（兼容直传中文）。
- journey 人物选择通用化：新增 `act.figure` 优先 → 否则按 `defaultFigure={tang:'玄奘',ming:'郑和'}` → 再否则取该朝首个带 route 者；匹配不到回退切朝+focus，不报错。
- 后端类型放宽：`KnowledgeEntry.dynasty`、`getEntriesByDynasty` 由 `'tang'|'ming'` 改为 `string`；`MapAction` 增 `figure?:string`；`EntryRow.dynasty` 改 string；lecture 去掉类型断言。
- schema：两个 `dynasty` 字段 ENUM→VARCHAR，迁移 `001_dynasty_to_varchar.sql` 对现有库执行成功。

#### （3）阶段1 首批扩充条目（1b）
- 新增 **20 条**（秦3、西汉4、东汉3、隋2、元4、清4），同步写入 `knowledge.ts`、`seed-data.sql`，迁移 `002_expanded_entries.sql` 落库。
- 落库核对：**knowledge_entries=40、evidence=80、map_actions=39**；朝代分布 qin3/xihan4/donghan3/sui2/tang10/yuan4/ming10/qing4。

#### （4）扩池回归与 hybrid 元数据过滤（阶段2 核心）
- **回归现象**：扩池后“宋朝疆域有多大”被新条目语义误召回（top1 yuan-01 0.648 ≥ 旧阈值 0.6），level3 误判为 level1。
- 40 条语料分数标定：同朝代真实命中 top1 ≥0.70；跨朝代邻近误召回 0.60~0.65；域外/无关 ≤0.59。
- **修复方案（不依赖单一阈值）**：新增 `dynasty-detect.ts` 纯规则识别问题朝代（含“汉”→西汉/东汉、“宋”→不在库等映射）。
  - 识别出朝代但全部不在库（如宋）→ 直接 level3，不做语义召回；
  - 识别出可答朝代 → `semanticSearch` 先按 dynasty 元数据过滤候选，同朝代内用**宽松阈值 0.45** 宽进，多口径再由 0.93 分数比严格把关；
  - 识别不出朝代走全局 → 用**严格阈值 0.68** 兜底（卡在真实命中 0.70 之下、误召回 0.65 之上）。
- 无朝代泛问（如“最西到哪”“疆域有多大”）跨朝代候选互相竞争且低于 0.68，按 level3 让学生澄清，避免武断指错朝代，属严谨安全行为。
- **相关问题**：`buildRelated` 基于同朝代、共享关键词动态生成最多 3 条 `relatedQuestions`（不改表结构、不参与分级），前端可点击直接追问。

#### （5）史料问答可拖动顶层悬浮窗（MapView.vue）
- 问答面板由右栏固定布局改为 `position:fixed` 顶层悬浮窗（z-index 1000），地图全屏铺满。
- pointer events 拖拽（统一鼠标/触摸），实时边界限制（标题栏始终在视口内）；支持收起/展开、关闭（带右下角重开按钮）；位置与收起状态经 `localStorage` 持久化。
- 控制按钮 `pointerdown.stop`，避免点按误触发拖拽。

#### （6）界面响应式/自适应
- 清除 Vite 模板遗留的 `#app { width:1126px; text-align:center; border-inline }`，改为全宽全高、左对齐的无干扰容器。
- 三端媒体查询：TeachView 两栏在 ≤900px 改单列；LearnView/导航/卡片在 ≤560px 收紧内边距；悬浮窗在 ≤480px 近全宽。

#### 验证结果
- 后端 `npm run build`（tsc）、前端 `npm run build`（vue-tsc + vite）均通过；最终 `npm run verify` **20 passed / 0 failed**（条件答保持 level2、范围声明保持 level3）。
- 浏览器实测：拖拽/边界/收起/关闭/重开、相关问题点击追问、地图 postMessage 联动（点击后地图 cur=13 唐、视图飞行到对应坐标）全部通过，无控制台错误。

## 3. CodeArts 使用记录

### 3.1 开发方式
- 所有代码通过 CodeArts 代码智能体编写
- 对话式开发：描述需求 → CodeArts 生成代码 → 验证 → 迭代
- 文件操作：创建、编辑、删除均通过 CodeArts 工具完成

### 3.2 关键开发对话节点

| 节点 | 操作 | 产出 |
|------|------|------|
| 方案设计 | 分析赛题要求，确定改造方向 | V3 完整能力版方案 |
| 脚手架 | 创建 server/ 和 frontend/ 项目结构 | package.json, tsconfig.json |
| 后端引擎 | 逐模块实现 grader/knowledge/lecture/deviation | 4 个核心引擎文件 |
| API 路由 | 实现 3 个路由模块 | qa.ts, lecture.ts, deviation.ts |
| 前端框架 | 创建 router/main/App + 3 个 API 客户端 | 6 个前端基础文件 |
| 前端页面 | 实现 MapView/TeachView/LearnView | 3 个 View 组件 |
| 构建验证 | npm run build + 端到端测试 | 5/5 测试通过 |
| 数据库 | 设计 RDS schema | schema.sql |
| 部署方案 | 编写云部署配置 | cloud-deployment.md |

### 3.3 验证记录
- 前端构建：vue-tsc 类型检查通过，vite 打包成功
- 后端测试：5 项端到端测试全部通过
- API 一致性：前端 API 客户端与后端路由签名完全匹配

## 4. 待完成事项（随推进持续更新）

- [x] 版本库初始化与基线提交（2026-10-31，commit `427016b`，165 文件）
- [x] Redis 客户端接入与降级封装（`db/redis.ts`；本地 6379 实例可用，无实例时自动降级）
- [x] RDS 数据接入（MySQL 连接层 + 优雅降级；专用账号 history；已完成真实初始化与读写联调，2026-10-31）
- [x] postMessage 地图联动闭环（`__MAP.focusOnAction` 统一入口 + 同源校验；修复 Vue Proxy 的 DataCloneError；admin/military/journey 四分支实测通过；2026-10-31 本地联调，详见 2.10）
- [x] 真实模型接入与 RAG 检索（bge-m3 向量 + openpangu-2.0-flash 润色；四档规则分级保持不变；2026-10-31 本地联调通过，verify 20/20；详见 2.9）
- [x] 材料池扩充至 40 条 + hybrid 元数据过滤/双轨阈值/相关问题（2026-10-31，verify 20/20；详见 2.11）
- [x] 史料问答可拖动顶层悬浮窗 + 三端响应式自适应（2026-10-31；详见 2.11）
- [ ] 鸿蒙展陈端联调（手机控制 + 大屏接收，页面骨架已存在）
- [ ] 昇腾边缘离线推理（方案已写，暂不实现）
- [ ] ECS 实际部署与验证（**按用户要求，前四步审查通过后再进行**）
- [ ] CodeArts 流水线配置 CI/CD（部署阶段进行）

## 5. 版本库基线与提交规范

- 2026-10-31 在项目根目录建立 Git 仓库（主分支 `main`），根 `.gitignore` 排除 `node_modules`、`dist`、`.workbuddy`、`.codeartsdoer`、`.arts`、`.env` 等。
- 基线提交：`427016b chore: 初始化版本库并固化既有作品与三端骨架基线 [AI]`。
- 后续提交的类型、协作标记（`[AI]` / `[人工修改]` / `[AI+人工]`）与人机协作流程，统一遵循 `docs/commits-and-collaboration.md`。
- 本地开发环境（已核实）：Node v22.23.2、npm 10.9.8、Git 2.35；MySQL 8.4 监听 3306（禅道自带库在 3307，互不影响）；Redis 监听 6379，无密码可连。