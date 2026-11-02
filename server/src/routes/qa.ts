import { Router } from 'express';
import {
  grade,
  gradeLabel,
  type GradedResponse,
  type RelatedQuestion,
  type RetrievalTrace,
} from '../engine/grader.js';
import {
  searchKnowledgeRepo,
  getAllEntriesRepo,
  getDataFingerprint,
} from '../data/knowledge-repo.js';
import type { RetrievalHit, KnowledgeEntry } from '../data/knowledge.js';
import { semanticSearch } from '../rag/vector-store.js';
import { caliberScoreRatio, fuse } from '../rag/fusion.js';
import {
  generateAnswer,
  groundingIssues,
  rewriteQuestion,
  type HistoryTurn,
} from '../rag/generator.js';
import { isEmbeddingConfigured, isLlmConfigured } from '../llm/client.js';
import { cacheGet, cacheSet } from '../db/redis.js';
import { detectDynasties } from '../engine/dynasty-detect.js';

export const qaRouter = Router();

/** 次条与首条分数比达到该阈值，才视为“并列竞争的多口径”；低于则视为邻近噪声，不触发条件答。 */
const MULTI_CALIBER_SCORE_RATIO = 0.93;

/**
 * 混合检索：语义召回与关键词召回两路都取回，按 RRF 名次分融合，两路都命中的条目录为 hybrid。
 * 语义路径保留原有阈值（限定朝代 0.45 宽进、全局 0.68 严格兜底）；关键词路径受朝代过滤约束。
 */
async function retrieve(question: string, dynastyCodes?: string[]): Promise<RetrievalHit[]> {
  const inDynasty = !!(dynastyCodes && dynastyCodes.length);

  let semantic: RetrievalHit[] = [];
  if (isEmbeddingConfigured()) {
    try {
      semantic = await semanticSearch(question, 5, inDynasty ? 0.45 : 0.68, dynastyCodes);
    } catch (e) {
      console.error('semanticSearch failed, fallback to keyword:', (e as Error).message);
    }
  }

  const kw = await searchKnowledgeRepo(question);
  const keywordHits = inDynasty ? kw.filter(h => dynastyCodes!.includes(h.entry.dynasty)) : kw;

  return fuse(semantic, keywordHits, 5);
}

const VIA_LABELS: Record<string, string> = {
  semantic: '语义',
  keyword: '关键词',
  hybrid: '语义+关键词',
};

/** 组装检索溯源（只用于解释展示，不参与分级）。 */
function buildTrace(
  effectiveQuestion: string,
  rewritten: boolean,
  dynastyCodes: string[],
  hits: RetrievalHit[],
  rationale: string,
): RetrievalTrace {
  return {
    effectiveQuestion,
    rewritten,
    dynastyCodes,
    hits: hits.map(h => ({
      id: h.entry.id,
      dynasty: h.entry.dynasty,
      question: h.entry.question,
      via: h.via ?? 'keyword',
      score: Number(h.score.toFixed(4)),
      ...(h.semScore != null ? { semScore: Number(h.semScore.toFixed(4)) } : {}),
      ...(h.kwScore != null ? { kwScore: h.kwScore } : {}),
    })),
    rationale,
  };
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
  const { question, history } = req.body as { question: string; history?: HistoryTurn[] };

  if (!question || !question.trim()) {
    res.status(400).json({ error: '问题不能为空' });
    return;
  }

  // 多轮指代改写：结合最近对话把问题补全为可独立检索的自包含问题；失败/无 LLM 时回退原文
  let effectiveQuestion = question.trim();
  if (Array.isArray(history) && history.length > 0 && isLlmConfigured()) {
    try {
      effectiveQuestion = await rewriteQuestion(effectiveQuestion, history);
    } catch (e) {
      console.error('rewriteQuestion failed, use original:', (e as Error).message);
    }
  }

  const rewritten = effectiveQuestion !== question.trim();
  // 缓存键带上数据指纹：条目一改，旧问答缓存自动失效，不再返回基于旧材料的答案
  const fp = await getDataFingerprint();
  const cacheKey = `qa:${fp}:${effectiveQuestion.toLowerCase()}`;
  const cached = await cacheGet<GradedResponse>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const dyn = detectDynasties(effectiveQuestion);

  // 识别出朝代但全部不在库（如宋）→ 直接范围声明，不做语义召回
  if (dyn.codes.length > 0 && dyn.answerableCodes.length === 0) {
    const graded: GradedResponse = {
      level: 3,
      answer: '本系统暂未收录该朝代的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（秦、两汉、三国、南北朝、隋、唐、五代十国、辽宋夏金、南宋、元、明、清）'],
      retrieval: buildTrace(
        effectiveQuestion,
        rewritten,
        dyn.answerableCodes,
        [],
        `识别到朝代「${dyn.codes.join('、')}」，但本系统未收录该朝代，按范围声明(L3)处理，不做召回`,
      ),
    };
    await cacheSet(cacheKey, graded, 300);
    res.json(graded);
    return;
  }

  const results = await retrieve(effectiveQuestion, dyn.answerableCodes);

  if (results.length === 0) {
    const graded: GradedResponse = {
      level: 3,
      answer: '本系统暂未收录该问题的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（秦、两汉、三国、南北朝、隋、唐、五代十国、辽宋夏金、南宋、元、明、清）'],
      retrieval: buildTrace(
        effectiveQuestion,
        rewritten,
        dyn.answerableCodes,
        [],
        '语义召回与关键词召回均无命中，按范围声明(L3)处理',
      ),
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
      caliberScoreRatio(top, second) >= MULTI_CALIBER_SCORE_RATIO &&
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

  // 模型仅负责把结论改写为自然语言作答；分级、出处、地图动作、口径保持规则引擎结果。
  // 事实护栏：改写出材料外数字或长度失控时，丢弃生成结果、保留规则引擎答案。
  if (isLlmConfigured()) {
    const entries = results.map(h => h.entry);
    const generated = await generateAnswer(effectiveQuestion, entries);
    if (generated) {
      const issues = groundingIssues(generated, effectiveQuestion, entries);
      if (issues.length > 0) {
        console.warn(`generated answer rejected (${issues.join('; ')})，回退规则引擎答案`);
      } else {
        graded.answer = generated;
      }
    }
  }

  const semText = top.semScore != null ? `语义 ${top.semScore.toFixed(2)}` : '无语义分';
  graded.retrieval = buildTrace(
    effectiveQuestion,
    rewritten,
    dyn.answerableCodes,
    results,
    hasMultipleCalibers && second
      ? `首条 ${top.entry.id}（${VIA_LABELS[top.via ?? 'keyword']}，${semText}）与次条 ${second.entry.id} 同朝代、口径不同且分数比 ≥ ${MULTI_CALIBER_SCORE_RATIO}，按${gradeLabel(graded.level)}(L${graded.level})处理`
      : `首条 ${top.entry.id}（${VIA_LABELS[top.via ?? 'keyword']}，${semText}），无并列口径，按${gradeLabel(graded.level)}(L${graded.level})处理`,
  );

  await cacheSet(cacheKey, graded, 300);
  res.json(graded);
});
