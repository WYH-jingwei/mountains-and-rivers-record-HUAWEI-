import { Router } from 'express';
import { grade, type GradedResponse } from '../engine/grader.js';
import { searchKnowledgeRepo } from '../data/knowledge-repo.js';
import type { KnowledgeEntry } from '../data/knowledge.js';
import { semanticSearch } from '../rag/vector-store.js';
import { generateAnswer } from '../rag/generator.js';
import { isEmbeddingConfigured, isLlmConfigured } from '../llm/client.js';
import { cacheGet, cacheSet } from '../db/redis.js';

export const qaRouter = Router();

/** 检索：配置 embedding 时走语义召回（失败回退关键词），否则走关键词检索。 */
async function retrieve(question: string): Promise<KnowledgeEntry[]> {
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
  const hasMultipleCalibers =
    results.length > 1 && results.some(r => r.caliber !== top.caliber);

  // 四档分级完全由规则引擎决定，模型不参与分级
  const graded = grade({
    evidence: top.evidence,
    hasMultipleCalibers,
    outOfScope: false,
    noConsensus: top.noConsensus ?? false,
    answer: top.answer,
    mapAction: top.mapAction,
  });

  if (hasMultipleCalibers && results.length > 1) {
    graded.evidence = [...top.evidence, ...results[1].evidence];
  }

  // 模型仅负责把结论改写为自然语言作答；分级、出处、地图动作、口径保持规则引擎结果
  if (isLlmConfigured()) {
    const generated = await generateAnswer(question, results);
    if (generated) graded.answer = generated;
  }

  await cacheSet(cacheKey, graded, 300);
  res.json(graded);
});
