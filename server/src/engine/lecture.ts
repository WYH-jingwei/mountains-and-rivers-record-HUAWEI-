import { getEntriesByDynasty, type KnowledgeEntry } from '../data/knowledge.js';

export interface LecturePackage {
  dynasty: string;
  maps: { title: string; year: number; layer: string }[];
  questions: { id: string; question: string; options: string[]; correctAnswer: string; evidenceSource: string }[];
  evidenceCards: { source: string; quote: string; confidence: string }[];
}

const dynastyLabels: Record<string, string> = {
  tang: '唐',
  ming: '明',
};

const dynastyYears: Record<string, number> = {
  tang: 661,
  ming: 1424,
};

export function getLecturePackage(dynasty: string): LecturePackage {
  const entries = getEntriesByDynasty(dynasty as 'tang' | 'ming');
  const year = dynastyYears[dynasty] ?? 0;
  const label = dynastyLabels[dynasty] ?? dynasty;

  const maps = entries
    .filter(e => e.mapAction)
    .map(e => ({
      title: `${label} ${e.question}`,
      year: e.mapAction!.year ?? year,
      layer: e.mapAction!.layer,
    }));

  const questions = entries.slice(0, 5).map((e, i) => ({
    id: `${dynasty}-q${i + 1}`,
    question: e.question,
    options: buildOptions(e),
    correctAnswer: e.answer.split('。')[0] + '。',
    evidenceSource: e.evidence[0]?.source ?? '',
  }));

  const evidenceCards = entries.flatMap(e =>
    e.evidence.map(ev => ({
      source: ev.source,
      quote: ev.quote,
      confidence: ev.confidence,
    })),
  );

  return { dynasty: label, maps, questions, evidenceCards };
}

function buildOptions(entry: KnowledgeEntry): string[] {
  const correct = entry.answer.split('。')[0] + '。';

  const distractors: string[] = [];
  if (entry.dynasty === 'tang') {
    if (entry.caliber === '直辖') {
      distractors.push('含羁縻约 1237 万平方公里');
    }
    if (entry.caliber === '含羁縻') {
      distractors.push('直辖约 944 万平方公里');
    }
    if (entry.caliber === '行迹') {
      distractors.push('此为行政管辖范围');
    }
    if (entry.caliber === '羁縻') {
      distractors.push('此为直辖正州');
    }
  }
  if (entry.dynasty === 'ming') {
    if (entry.caliber === '直辖') {
      distractors.push('此为羁縻卫所');
    }
    if (entry.caliber === '羁縻') {
      distractors.push('此为直辖布政使司');
    }
    if (entry.caliber === '行迹') {
      distractors.push('此为行政管辖范围');
    }
  }
  distractors.push('本系统未收录该信息');

  while (distractors.length < 3) {
    distractors.push('以上均不准确');
  }

  return [correct, ...distractors.slice(0, 3)];
}