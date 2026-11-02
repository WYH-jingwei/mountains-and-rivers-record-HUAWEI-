export interface Evidence {
  source: string;
  quote: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface MapAction {
  dynasty: string;
  year?: number;
  layer: 'admin' | 'military' | 'journey' | 'cultural';
  focus?: [number, number];
  /** 行迹层（journey）指定人物名；缺省时由地图按朝代默认人物或首个带路线者处理。 */
  figure?: string;
}

export interface GraderInput {
  evidence: Evidence[];
  hasMultipleCalibers: boolean;
  outOfScope: boolean;
  noConsensus: boolean;
  answer: string;
  mapAction?: MapAction;
}

export interface RelatedQuestion {
  id: string;
  question: string;
}

/** 单条召回：用于“检索依据”面板，展示命中了哪些条目、走哪条路径、分数多少。 */
export interface RetrievalHitTrace {
  id: string;
  dynasty: string;
  question: string;
  via: 'semantic' | 'keyword' | 'hybrid';
  /** 融合排序分。 */
  score: number;
  /** 语义余弦相似度（语义路径命中时存在）。 */
  semScore?: number;
  /** 关键词原始打分（关键词路径命中时存在）。 */
  kwScore?: number;
}

/** 检索与定级溯源：只做解释展示，不参与分级判定。 */
export interface RetrievalTrace {
  /** 实际用于检索的问题（多轮指代改写后的版本）。 */
  effectiveQuestion: string;
  /** 是否经过上下文指代改写。 */
  rewritten: boolean;
  /** 识别到的可答朝代代码。 */
  dynastyCodes: string[];
  /** 召回命中（最多 5 条）。 */
  hits: RetrievalHitTrace[];
  /** 定级依据说明（直答/条件答/范围声明分别为何成立）。 */
  rationale: string;
}

export interface GradedResponse {
  level: 1 | 2 | 3 | 4;
  answer: string;
  evidence: Evidence[];
  uncertainty: string[];
  mapAction?: MapAction;
  /** 同朝代相关问题（体验层附加，由 qa 路由基于检索/关键词动态生成，不参与分级）。 */
  relatedQuestions?: RelatedQuestion[];
  /** 检索溯源（体验层附加，供前端展示检索依据，不参与分级）。 */
  retrieval?: RetrievalTrace;
}

const LEVEL_LABELS: Record<number, string> = {
  1: '直答',
  2: '条件答',
  3: '范围声明',
  4: '证据展示',
};

export function gradeLabel(level: number): string {
  return LEVEL_LABELS[level] ?? '未知';
}

export function grade(input: GraderInput): GradedResponse {
  if (input.outOfScope) {
    return {
      level: 3,
      answer: input.answer,
      evidence: [],
      uncertainty: ['超出本系统当前收录范围（秦、两汉、三国、南北朝、隋、唐、五代十国、辽宋夏金、南宋、元、明、清）'],
    };
  }

  if (input.noConsensus) {
    return {
      level: 4,
      answer: input.answer,
      evidence: input.evidence,
      uncertainty: ['学界对此无定论，以下为已知证据与争议方，不画闭合边界'],
    };
  }

  if (input.hasMultipleCalibers) {
    return {
      level: 2,
      answer: input.answer,
      evidence: input.evidence,
      uncertainty: ['存在多种口径，请注意区分'],
      mapAction: input.mapAction,
    };
  }

  if (input.evidence.length === 0) {
    return {
      level: 3,
      answer: '本系统暂未收录该问题的相关史料',
      evidence: [],
      uncertainty: ['超出本系统当前收录范围'],
    };
  }

  return {
    level: 1,
    answer: input.answer,
    evidence: input.evidence,
    uncertainty: [],
    mapAction: input.mapAction,
  };
}