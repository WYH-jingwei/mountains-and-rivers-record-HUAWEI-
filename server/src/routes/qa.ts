import { Router } from 'express';
import { grade, type GradedResponse, type RelatedQuestion } from '../engine/grader.js';
import { searchKnowledgeRepo, getAllEntriesRepo } from '../data/knowledge-repo.js';
import type { RetrievalHit, KnowledgeEntry } from '../data/knowledge.js';
import { semanticSearch } from '../rag/vector-store.js';
import { generateAnswer } from '../rag/generator.js';
import { isEmbeddingConfigured, isLlmConfigured } from '../llm/client.js';
import { cacheGet, cacheSet } from '../db/redis.js';
import { detectDynasties } from '../engine/dynasty-detect.js';

export const qaRouter = Router();

/** 次条与首条分数比达到该阈值，才视为“并列竞争的多口径”；低于则视为邻近噪声，不触发条件答。 */
const MULTI_CALIBER_SCORE_RATIO = 0.93;

/**
 * 检索：配置 embedding 时走语义召回（失败回退关键词），否则走关键词检索。统一返回带分数命中项。
 * dynastyCodes 非空时限定候选朝代（hybrid 元数据过滤）：跨朝代误召回已被元数据排除，
 * 故同朝代内用宽松阈值 0.45 宽进，再由多口径分数比 0.93 严格把关；识别不出朝代走全局
 * 兜底时才用严格阈值 0.68 防止跨朝代邻近误召回。
 */
async function retrieve(question: string, dynastyCodes?: string[]): Promise<RetrievalHit[]> {
  const inDynasty = !!(dynastyCodes && dynastyCodes.length);
  if (isEmbeddingConfigured()) {
    try {
      return await semanticSearch(question, 5, inDynasty ? 0.45 : 0.68, dynastyCodes);
    } catch (e) {
      console.error('semanticSearch failed, fallback to keyword:', (e as Error).message);
    }
  }
  const kw = await searchKnowledgeRepo(question);
  return inDynasty
    ? kw.filter(h => dynastyCodes!.includes(h.entry.dynasty))
    : kw;
}

/**
 * 动态生成同朝代“相关问题”（最多3条）：先取本次检索中的同朝代其他命中，
 * 不足再用同朝代、共享关键词数多者补充。不改动表结构，体验层附加、不参与分级。
 */
function buildRelated(
  top: RetrievalHit,
  results: RetrievalHit[],
  all: KnowledgeEntry[],
): RelatedQuestion[] {
  const picked: RelatedQuestion[] = [];
  const seen = new Set<string>([top.entry.id]);

  for (const h of results.slice(1)) {
    if (h.entry.dynasty === top.entry.dynasty && !seen.has(h.entry.id)) {
      picked.push({ id: h.entry.id, question: h.entry.question });
      seen.add(h.entry.id);
    }
    if (picked.length >= 3) return picked;
  }

  const sharedCount = (e: KnowledgeEntry) =>
    e.keywords.filter(k => top.entry.keywords.includes(k)).length;
  const sameDynasty = all
    .filter(e => e.dynasty === top.entry.dynasty && !seen.has(e.id))
    .sort((a, b) => sharedCount(b) - sharedCount(a));
  for (const e of sameDynasty) {
    picked.push({ id: e.id, question: e.question });
    if (picked.length >= 3) break;
  }
  return picked;
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

  const dyn = detectDynasties(question);

  // 识别出朝代但全部不在库（如宋）→ 直接范围声明，不做语义召回
  if (dyn.codes.length > 0 && dyn.answerableCodes.length === 0) {
    const graded: GradedResponse = {
      level: 3,
      answer: '本系统暂未收录该朝代的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（秦、两汉、隋、唐、元、明、清）'],
    };
    await cacheSet(cacheKey, graded, 300);
    res.json(graded);
    return;
  }

  const results = await retrieve(question, dyn.answerableCodes);

  if (results.length === 0) {
    const graded: GradedResponse = {
      level: 3,
      answer: '本系统暂未收录该问题的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（秦、两汉、隋、唐、元、明、清）'],
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

  // 体验层附加同朝代相关问题（不参与分级）
  const allEntries = await getAllEntriesRepo();
  graded.relatedQuestions = buildRelated(top, results, allEntries);

  // 模型仅负责把结论改写为自然语言作答；分级、出处、地图动作、口径保持规则引擎结果
  if (isLlmConfigured()) {
    const generated = await generateAnswer(question, results.map(h => h.entry));
    if (generated) graded.answer = generated;
  }

  await cacheSet(cacheKey, graded, 300);
  res.json(graded);
});
