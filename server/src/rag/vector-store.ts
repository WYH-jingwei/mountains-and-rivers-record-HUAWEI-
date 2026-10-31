import { createEmbedding } from '../llm/client.js';
import { getAllEntriesRepo } from '../data/knowledge-repo.js';
import { cacheGet, cacheSet } from '../db/redis.js';
import type { KnowledgeEntry, RetrievalHit } from '../data/knowledge.js';

let vectors: Map<string, number[]> | null = null;
let inflight: Promise<Map<string, number[]>> | null = null;

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

/** 获取（或懒构建）全部条目向量；优先读 Redis 缓存，缺失则调用 embedding 接口。 */
async function getVectors(): Promise<Map<string, number[]>> {
  if (vectors) return vectors;
  if (inflight) return inflight;

  inflight = (async () => {
    const entries = await getAllEntriesRepo();
    const cacheKey = `rag:vectors:${process.env.EMBEDDING_MODEL || 'default'}`;

    const cached = await cacheGet<Record<string, number[]>>(cacheKey);
    if (cached && Object.keys(cached).length === entries.length) {
      vectors = new Map(Object.entries(cached));
      return vectors;
    }

    const embeddings = await createEmbedding(entries.map(embeddingText));
    const map = new Map<string, number[]>();
    entries.forEach((entry, i) => map.set(entry.id, embeddings[i]));
    vectors = map;

    await cacheSet(cacheKey, Object.fromEntries(map), 86400);
    return map;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * 语义检索（hybrid）：先按朝代元数据过滤候选，再向量化问题、按余弦相似度返回 topK。
 * 40 条语料标定（2026-10-31）：同朝代真实命中 top1 ≥0.70；跨朝代邻近误召回 0.60~0.65；
 * 域外/无关问题 ≤0.59。阈值由调用方分场景给定：限定朝代时跨朝代噪声已被元数据排除，
 * 用宽松阈值 0.45 宽进（多口径再由 0.93 分数比把关）；识别不出朝代走全局时用 0.68 严格
 * 兜底（卡在真实命中 0.70 之下、误召回 0.65 之上）。关键词降级路径不受此阈值影响。
 */
export async function semanticSearch(
  question: string,
  topK = 5,
  minScore = 0.68,
  dynastyCodes?: string[],
): Promise<RetrievalHit[]> {
  const all = await getAllEntriesRepo();
  // hybrid 元数据过滤：限定朝代后再做向量排序，避免跨朝代邻近条目被误召回
  const entries = dynastyCodes && dynastyCodes.length
    ? all.filter(e => dynastyCodes.includes(e.dynasty))
    : all;
  const [queryVector] = await createEmbedding(question);
  const vecs = await getVectors();

  return entries
    .map(entry => ({
      entry,
      score: cosineSimilarity(queryVector, vecs.get(entry.id) ?? []),
    }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
