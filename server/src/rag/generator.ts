import { chatCompletion, type ChatMessage } from '../llm/client.js';
import type { KnowledgeEntry } from '../data/knowledge.js';

const SYSTEM_PROMPT = [
  '你是《舆图山河录》历史地理课堂的助教。请严格依据用户提供的材料作答，遵守以下规则：',
  '1. 区分三种疆域："管到"（实际行政管辖）、"写到"（文献记载但未设治）、"走到"（人物行迹到达），三者不得混为一谈。',
  '2. 只能使用材料中出现的史实与结论；材料不足时直接说明"现有材料不足以确认"，绝不编造年份、地名或管辖关系。',
  '3. 若材料中存在学界分歧或范围声明，需明确指出，不给出确定化的错误结论。',
  '4. 语言简洁准确，适合课堂讲解，200 字以内，不要罗列材料编号。',
].join('\n');

function formatMaterials(entries: KnowledgeEntry[]): string {
  return entries
    .map((e, i) => {
      const lines = [
        `【材料${i + 1}】问题：${e.question}`,
        `结论：${e.answer}`,
        `口径：${e.caliber}${e.noConsensus ? '（存在学界分歧）' : ''}`,
      ];
      if (e.evidence.length) {
        lines.push('出处：' + e.evidence.map(ev => `${ev.source}（${ev.quote}）`).join('；'));
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

/** 基于召回条目生成自然语言答案；调用失败时返回 null 由上层回退。 */
export async function generateAnswer(
  question: string,
  entries: KnowledgeEntry[],
): Promise<string | null> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `材料：\n${formatMaterials(entries)}\n\n学生提问：${question}`,
    },
  ];

  try {
    return await chatCompletion(messages, 0.3);
  } catch (e) {
    console.error('generateAnswer failed:', (e as Error).message);
    return null;
  }
}
