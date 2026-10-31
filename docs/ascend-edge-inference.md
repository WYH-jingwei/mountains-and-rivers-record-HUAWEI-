# 昇腾边缘离线推理方案

## 场景

在无网络或网络不稳定的教学环境中（如偏远地区课堂），系统需要完全离线运行。昇腾 NPU 提供边缘计算能力，使 AI 推理在本地完成。

## 架构

```
昇腾 Atlas 200I DK A2（边缘设备）
├── 本地知识库（SQLite / 文件）
├── 四档分级规则引擎（本地运行）
├── 关键词检索（本地索引）
├── 地图 HTML（本地文件）
└── Web 服务（本地 HTTP）
```

## 实现方案

### 1. 知识库本地化

将 `knowledge.ts` 中的 20 条知识数据导出为 JSON 文件，在边缘设备上用 SQLite 或纯文件方式加载：

```typescript
// edge/knowledge-local.ts
import knowledgeData from './knowledge-data.json';

export function searchLocal(question: string): KnowledgeEntry[] {
  const q = question.toLowerCase().trim();
  return knowledgeData
    .map(entry => ({
      entry,
      score: entry.keywords.reduce((s: number, kw: string) =>
        s + (q.includes(kw.toLowerCase()) ? 2 : 0), 0)
        + (entry.question.toLowerCase().includes(q) ? 5 : 0)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.entry);
}
```

### 2. 四档分级引擎本地化

规则引擎本身不依赖 AI 模型，是确定性逻辑，直接本地运行：

```typescript
// edge/grader-local.ts — 与 server/src/engine/grader.ts 逻辑完全一致
// 输入：evidence[], hasMultipleCalibers, outOfScope, noConsensus, answer
// 输出：GradedResponse { level, answer, evidence, uncertainty, mapAction }
```

### 3. 昇腾 NPU 加速（可选增强）

当需要更复杂的语义匹配时（如模糊问题匹配），可用昇腾 NPU 运行轻量 embedding 模型：

- 模型：使用 MindSpore Lite + 昇腾 NPU 加速
- 功能：将用户问题与知识条目问题做语义相似度计算
- 优势：比关键词匹配更智能，支持"唐朝西边在哪"匹配"唐朝最西到哪"
- 离线模型大小：约 50MB（MiniLM 级别）

```python
# edge/semantic_match.py（昇腾 NPU 推理）
import mindspore_lite as mslite

model = mslite.Model()
model.build_from_file('semantic_model.mindir', mslite.ModelType.MINDIR, context)

def match_question(user_question, knowledge_questions):
    user_emb = model.predict([user_question])
    scores = [cosine_sim(user_emb, model.predict([q])) for q in knowledge_questions]
    return sorted(zip(scores, knowledge_questions), reverse=True)
```

### 4. 本地 Web 服务

在昇腾 Atlas 200I DK A2 上运行轻量 HTTP 服务：

```typescript
// edge/server-local.ts
import express from 'express';
import { searchLocal } from './knowledge-local';
import { gradeLocal } from './grader-local';

const app = express();
app.use(express.json());
app.use(express.static('./public')); // 地图 HTML

app.post('/api/qa', (req, res) => {
  const results = searchLocal(req.body.question);
  if (results.length === 0) {
    res.json({ level: 3, answer: '本系统暂未收录该问题', evidence: [], uncertainty: [] });
    return;
  }
  const graded = gradeLocal(results[0]);
  res.json(graded);
});

app.listen(3000, () => console.log('Edge server running'));
```

### 5. 离线部署包

```
edge-deploy/
├── server-local.js        # 编译后的本地服务
├── knowledge-data.json    # 知识数据
├── grader-local.js        # 分级引擎
├── public/
│   └── 舆图山河录.html    # 地图文件
├── semantic_model.mindir  # 昇腾语义模型（可选）
└── start.sh               # 启动脚本
```

### 6. 与在线模式的切换

```typescript
// 前端自动检测在线/离线模式
const isOnline = await fetch('/api/health').then(r => r.ok).catch(() => false);
const apiBase = isOnline ? '/api' : 'http://192.168.1.100:3000/api'; // 边缘设备地址
```

## 硬件要求

| 设备 | 型号 | 用途 |
|------|------|------|
| 昇腾 Atlas 200I DK A2 | 8TOPS @ INT8 | 边缘推理 + 本地服务 |
| 存储 | 32GB SD 卡 | 知识数据 + 地图 HTML + 模型 |
| 网络 | 局域网 WiFi | 教师手机/大屏连接边缘设备 |

## 与在线模式的差异

| 功能 | 在线模式 | 离线模式 |
|------|---------|---------|
| 知识检索 | MySQL + 关键词 | SQLite/JSON + 关键词 |
| 四档分级 | 云端规则引擎 | 本地规则引擎（相同逻辑） |
| 语义匹配 | 可选（云端大模型） | 昇腾 NPU 轻量模型 |
| 缓存 | Redis | 内存缓存 |
| 数据库 | RDS MySQL | SQLite |
| 地图 | OBS/CDN | 本地文件 |
| 作答记录 | RDS 持久化 | SQLite 本地存储 |