import { Router } from 'express';
import { grade, type GradedResponse } from '../engine/grader.js';
import { searchKnowledgeRepo } from '../data/knowledge-repo.js';
import { cacheGet, cacheSet } from '../db/redis.js';

export const qaRouter = Router();

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

  const results = await searchKnowledgeRepo(question);

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
  const hasMultipleCalibers = results.length > 1 &&
    results.some(r => r.caliber !== top.caliber);

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

  await cacheSet(cacheKey, graded, 300);
  res.json(graded);
});