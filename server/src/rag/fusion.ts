import type { RetrievalHit } from '../data/knowledge.js';

/** RRF 融合常数：各路径按名次贡献 1/(K+rank)，60 为常用取值。 */
export const RRF_K = 60;

/** RRF 融合：两路结果按名次累加 1/(K+rank)，再按融合分排序取前 topK。 */
export function fuse(semantic: RetrievalHit[], keyword: RetrievalHit[], topK: number): RetrievalHit[] {
  const merged = new Map<string, RetrievalHit>();

  semantic.forEach((hit, i) => {
    merged.set(hit.entry.id, {
      entry: hit.entry,
      score: 1 / (RRF_K + i + 1),
      semScore: hit.score,
      via: 'semantic',
    });
  });

  keyword.forEach((hit, i) => {
    const add = 1 / (RRF_K + i + 1);
    const cur = merged.get(hit.entry.id);
    if (cur) {
      cur.score += add;
      cur.kwScore = hit.score;
      cur.via = 'hybrid';
    } else {
      merged.set(hit.entry.id, {
        entry: hit.entry,
        score: add,
        kwScore: hit.score,
        via: 'keyword',
      });
    }
  });

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * 并列口径判定用的分数比。双方都带语义相似度时用余弦比值（按 0.93 标定）；
 * 纯关键词路径退回关键词原始分词比；路径不一致（融合分基数不同）时不判定。
 */
export function caliberScoreRatio(top: RetrievalHit, second: RetrievalHit): number {
  if (top.semScore != null && second.semScore != null) {
    return top.semScore > 0 ? second.semScore / top.semScore : 0;
  }
  if (top.kwScore != null && second.kwScore != null) {
    return top.kwScore > 0 ? second.kwScore / top.kwScore : 0;
  }
  return top.score > 0 ? second.score / top.score : 0;
}
