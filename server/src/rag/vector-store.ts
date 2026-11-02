import { createEmbedding, createEmbeddingBatched } from '../llm/client.js';
import { getAllEntriesRepo } from '../data/knowledge-repo.js';
import { fingerprintEntries } from '../data/knowledge.js';
import { cacheGet, cacheInvalidate, cacheSet } from '../db/redis.js';
import type { KnowledgeEntry, RetrievalHit } from '../data/knowledge.js';

let vectors: Map<string, number[]> | null = null;
/** 进程内向量缓存对应的数据指纹：指纹变化即重建，避免条目改了却仍用旧向量。 */
let vectorsFp = '';
let inflight: Promise<Map<string, number[]>> | null = null;
let inflightFp = '';

/** 组装用于向量化的文本：问题 + 关键词 + 朝代 + 答案要点。 */
function embeddingText(entry: KnowledgeEntry): string {
  return [entry.dynasty, entry.question, entry.keywords.join(' '), entry.answer]
    .join(' ')
    .slice(0, 1000);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 获取（或懒构建）全部条目向量。缓存键与数据指纹绑定：只有指纹一致才复用，
 * 因此条目增删改后会自动重建，不再依赖“条数相等”这种脆弱的判断。
 */
async function getVectors(entries: KnowledgeEntry[], fp: string): Promise<Map<string, number[]>> {
  if (vectors && vectorsFp === fp) return vectors;
  if (inflight && inflightFp === fp) return inflight;

  const cacheKey = `rag:vectors:${process.env.EMBEDDING_MODEL || 'default'}:${fp}`;

  const cached = await cacheGet<Record<string, number[]>>(cacheKey);
  if (cached && entries.every(e => Array.isArray(cached[e.id]))) {
    vectors = new Map(Object.entries(cached));
    vectorsFp = fp;
    return vectors;
  }

  inflightFp = fp;
  inflight = createEmbeddingBatched(entries.map(embeddingText)).then(embeddings => {
    const map = new Map<string, number[]>();
    entries.forEach((entry, i) => map.set(entry.id, embeddings[i]));
    return map;
  });

  try {
    const map = await inflight;
    vectors = map;
    vectorsFp = fp;
    // 先清掉旧指纹的向量键（自动失效），再写入本次结果，避免历史指纹键在 Redis 里堆积
    await cacheInvalidate('rag:vectors:');
    await cacheSet(cacheKey, Object.fromEntries(map), 86400);
    return map;
  } finally {
    inflight = null;
    inflightFp = '';
  }
}

/**
 * 语义检索（hybrid）：先按朝代元数据过滤候选，再向量化问题、按余弦相似度返回 topK。
 * 64 条语料复测（2026-11-01，见 `npm run verify:rag`）：同朝代真实命中 top1 为 0.679~0.719；
 * 跨朝代邻近误召回最高 0.588；域外/无关问题最高 0.415。
 * 阈值由调用方分场景给定：限定朝代时跨朝代噪声已被元数据排除，用宽松阈值 0.45 宽进
 * （多口径再由 0.93 分数比把关）；识别不出朝代走全局时用 0.68 兜底。
 * 注意：最弱真实命中 0.679 略低于 0.68，语义单路会漏召，需靠关键词路径 RRF 兜底
 * （qa 路由两路都召回）；关键词降级路径不受此阈值影响。
 */
export async function semanticSearch(
  question: string,
  topK = 5,
  minScore = 0.68,
  dynastyCodes?: string[],
): Promise<RetrievalHit[]> {
  const all = await getAllEntriesRepo();
  const fp = fingerprintEntries(all);
  // hybrid 元数据过滤：限定朝代后再做向量排序，避免跨朝代邻近条目被误召回
  const entries = dynastyCodes && dynastyCodes.length
    ? all.filter(e => dynastyCodes.includes(e.dynasty))
    : all;
  const [queryVector] = await createEmbedding(question);
  const vecs = await getVectors(all, fp);

  return entries
    .map(entry => ({
      entry,
      score: cosineSimilarity(queryVector, vecs.get(entry.id) ?? []),
    }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map<RetrievalHit>(x => ({ entry: x.entry, score: x.score, semScore: x.score, via: 'semantic' }));
}
