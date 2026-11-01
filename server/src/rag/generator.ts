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

/** 一轮历史问答（用于多轮指代改写）。 */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * 结合最近对话，把学生最新问题改写为“不依赖上下文、可独立检索”的完整问题。
 * 仅补全指代（它/那里/东边/这个朝代等），不新增历史中没有的事实、不作答；
 * 调用失败由上层回退为原问题。
 */
export async function rewriteQuestion(
  question: string,
  history: HistoryTurn[],
): Promise<string> {
  const context = history
    .map(h => `${h.role === 'user' ? '学生' : '助教'}：${h.text}`)
    .join('\n');
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        '你是问题改写助手。根据对话历史，把学生最新的问题改写为一个不依赖上下文、可独立检索的完整问题。',
        '只补全指代（如“它、那里、东边、这个朝代”所指的对象），不得新增历史中没有的事实，不得作答或解释。',
        '只输出改写后的问句本身，30字以内，不要引号、不要编号。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `对话历史：\n${context}\n\n学生最新问题：${question}`,
    },
  ];
  const out = await chatCompletion(messages, 0.1);
  return out || question;
}
