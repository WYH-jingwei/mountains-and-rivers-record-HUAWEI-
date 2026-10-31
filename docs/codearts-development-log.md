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

## 4. 待完成事项

- [ ] postMessage 地图联动注入（地图 HTML 需添加消息监听器）
- [ ] RDS 数据迁移脚本（从 knowledge.ts 导入到 MySQL）
- [ ] Redis 缓存层实现（QA 结果缓存、讲解包缓存）
- [ ] ECS 实际部署与验证
- [ ] CodeArts 流水线配置（CI/CD）
- [ ] 鸿蒙展陈端（手机控制 + 大屏接收）
- [ ] 昇腾边缘离线推理