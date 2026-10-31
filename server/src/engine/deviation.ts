export interface AnswerRecord {
  studentId: string;
  classId: string;
  questionId: string;
  answer: string;
  timestamp: number;
}

export interface DeviationItem {
  type: '管到/写到混淆' | '走到/管到混淆' | '写到/管到混淆' | '范围超出' | '正确';
  count: number;
  description: string;
  suggestion: string;
}

export interface DeviationProfile {
  classId: string;
  totalAnswers: number;
  totalStudents: number;
  deviations: DeviationItem[];
  summary: string;
}

const answerStore: AnswerRecord[] = [];

const deviationTypeMap: Record<string, DeviationItem['type']> = {
  'tang-q1': '管到/写到混淆',
  'tang-q2': '管到/写到混淆',
  'tang-q3': '管到/写到混淆',
  'tang-q4': '管到/写到混淆',
  'tang-q5': '走到/管到混淆',
  'tang-q10': '走到/管到混淆',
  'ming-q1': '管到/写到混淆',
  'ming-q2': '管到/写到混淆',
  'ming-q3': '范围超出',
  'ming-q5': '走到/管到混淆',
};

const suggestionMap: Record<DeviationItem['type'], string> = {
  '管到/写到混淆': '建议用唐代安西都护府一页做对比讲解：直辖与羁縻是两种不同的管辖方式',
  '走到/管到混淆': '建议区分行迹到达与行政管辖：玄奘走到的地方不等于唐朝管到的地方',
  '写到/管到混淆': '建议区分文献记载与实际设治：《禹贡》九州是写到，不是管到',
  '范围超出': '建议说明明朝北面为蒙古诸部，无稳定边界，本系统不画闭合北界',
  '正确': '该知识点掌握良好',
};

export function recordAnswer(
  studentId: string,
  classId: string,
  questionId: string,
  answer: string,
): void {
  answerStore.push({
    studentId,
    classId,
    questionId,
    answer,
    timestamp: Date.now(),
  });
}

export function getDeviationProfile(classId: string): DeviationProfile {
  const classAnswers = answerStore.filter(a => a.classId === classId);
  const totalAnswers = classAnswers.length;
  const totalStudents = new Set(classAnswers.map(a => a.studentId)).size;

  const typeCounts: Record<string, number> = {};
  for (const ans of classAnswers) {
    const type = deviationTypeMap[ans.questionId] ?? '正确';
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  }

  const deviations: DeviationItem[] = Object.entries(typeCounts)
    .filter(([type]) => type !== '正确')
    .map(([type, count]) => ({
      type: type as DeviationItem['type'],
      count,
      description: `${count} 人出现"${type}"类型错误`,
      suggestion: suggestionMap[type as DeviationItem['type']],
    }))
    .sort((a, b) => b.count - a.count);

  const topDeviation = deviations[0];
  const summary = topDeviation
    ? `本班 ${topDeviation.count} 人${topDeviation.description.replace(/^\d+ 人/, '')}，${topDeviation.suggestion}`
    : '暂无偏差数据';

  return {
    classId,
    totalAnswers,
    totalStudents,
    deviations,
    summary,
  };
}