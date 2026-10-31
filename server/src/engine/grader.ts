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
}

export interface GraderInput {
  evidence: Evidence[];
  hasMultipleCalibers: boolean;
  outOfScope: boolean;
  noConsensus: boolean;
  answer: string;
  mapAction?: MapAction;
}

export interface GradedResponse {
  level: 1 | 2 | 3 | 4;
  answer: string;
  evidence: Evidence[];
  uncertainty: string[];
  mapAction?: MapAction;
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
      uncertainty: ['超出本系统当前收录范围（唐、明两朝）'],
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