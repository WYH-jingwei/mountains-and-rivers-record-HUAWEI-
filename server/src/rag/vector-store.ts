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
 * 语义检索：向量化问题，按余弦相似度返回 topK；低于阈值的条目不返回（避免强行匹配域外内容）。
 * 阈值 0.60 基于当前 20 条语料标定：真实命中 top1 ≥0.69，域外朝代（宋/汉/元/清）≤0.56，
 * 完全无关问题 ≤0.39；扩充语料后需复测阈值。关键词降级路径不受此阈值影响。
 */
export async function semanticSearch(
  question: string,
  topK = 5,
  minScore = 0.6,
): Promise<RetrievalHit[]> {
  const entries = await getAllEntriesRepo();
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
