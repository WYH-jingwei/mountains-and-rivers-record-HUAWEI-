import { Router } from 'express';
import { grade, type GradedResponse } from '../engine/grader.js';
import { searchKnowledgeRepo } from '../data/knowledge-repo.js';
import type { RetrievalHit } from '../data/knowledge.js';
import { semanticSearch } from '../rag/vector-store.js';
import { generateAnswer } from '../rag/generator.js';
import { isEmbeddingConfigured, isLlmConfigured } from '../llm/client.js';
import { cacheGet, cacheSet } from '../db/redis.js';

export const qaRouter = Router();

/** 次条与首条分数比达到该阈值，才视为“并列竞争的多口径”；低于则视为邻近噪声，不触发条件答。 */
const MULTI_CALIBER_SCORE_RATIO = 0.93;

/** 检索：配置 embedding 时走语义召回（失败回退关键词），否则走关键词检索。统一返回带分数命中项。 */
async function retrieve(question: string): Promise<RetrievalHit[]> {
  if (isEmbeddingConfigured()) {
    try {
      return await semanticSearch(question, 5);
    } catch (e) {
      console.error('semanticSearch failed, fallback to keyword:', (e as Error).message);
    }
  }
  return searchKnowledgeRepo(question);
}

qaRouter.post('/', async (req, res) => {
  const { question } = req.body as { question: string };

  if (!question || !question.trim()) {
    res.status(400).json({ error: '问题不能为空' });
    return;
  }

  const cacheKey = `qa:${question.trim().toLowerCase()}`;
  const cached = await cacheGet<GradedResponse>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const results = await retrieve(question);

  if (results.length === 0) {
    const graded: GradedResponse = {
      level: 3,
      answer: '本系统暂未收录该问题的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（唐、明两朝）'],
    };
    await cacheSet(cacheKey, graded, 300);
    res.json(graded);
    return;
  }

  const top = results[0];
  const second = results[1];
  // 多口径（条件答 level2）= 同一问题族下存在不同管辖口径，需同时满足：
  // 同朝代 + 口径不同 + 分数并列接近 + 共享主题关键词（同族）；
  // 排除跨朝代、不同方向/主题被语义邻近带入的噪声。分级规则本身仍由 grader 决定，模型不参与分级。
  const sameFamily =
    !!second && second.entry.keywords.some(k => top.entry.keywords.includes(k));
  const hasMultipleCalibers = Boolean(
    second &&
      second.entry.dynasty === top.entry.dynasty &&
      second.entry.caliber !== top.entry.caliber &&
      top.score > 0 &&
      second.score / top.score >= MULTI_CALIBER_SCORE_RATIO &&
      sameFamily,
  );

  // 四档分级完全由规则引擎决定，模型不参与分级
  const graded = grade({
    evidence: top.entry.evidence,
    hasMultipleCalibers,
    outOfScope: false,
    noConsensus: top.entry.noConsensus ?? false,
    answer: top.entry.answer,
    mapAction: top.entry.mapAction,
  });

  if (hasMultipleCalibers && second) {
    graded.evidence = [...top.entry.evidence, ...second.entry.evidence];
  }

  // 模型仅负责把结论改写为自然语言作答；分级、出处、地图动作、口径保持规则引擎结果
  if (isLlmConfigured()) {
    const generated = await generateAnswer(question, results.map(h => h.entry));
    if (generated) graded.answer = generated;
  }

  await cacheSet(cacheKey, graded, 300);
  res.json(graded);
});
