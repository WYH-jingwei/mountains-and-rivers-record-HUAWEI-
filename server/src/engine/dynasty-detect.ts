/**
 * 问题朝代识别（hybrid 检索的元数据过滤前置）。
 * 把问题中的中文朝代词/拼音映射为内部朝代代码；再由调用方判断该朝代是否在库。
 * 纯规则、可审计，不依赖模型。
 */

/** 当前材料池可答的朝代代码集合。 */
export const ANSWERABLE_DYNASTIES = new Set<string>([
  'qin', 'xihan', 'donghan', 'sui', 'tang', 'yuan', 'ming', 'qing',
]);

export interface DynastyDetect {
  /** 问题中识别出的全部朝代代码（含不在库的，如 song）。 */
  codes: string[];
  /** 其中材料池可答的朝代代码。 */
  answerableCodes: string[];
}

export function detectDynasties(question: string): DynastyDetect {
  const q = question.toLowerCase();
  const has = (s: string) => q.includes(s);
  const codes: string[] = [];
  const push = (c: string) => { if (!codes.includes(c)) codes.push(c); };

  // 汉：先判具体的西汉/东汉，否则泛“汉/汉朝”同时映射两汉
  if (has('西汉')) push('xihan');
  if (has('东汉')) push('donghan');
  if (!codes.includes('xihan') && !codes.includes('donghan') && (has('汉朝') || has('汉'))) {
    push('xihan'); push('donghan');
  }
  if (has('秦')) push('qin');
  if (has('隋')) push('sui');
  if (has('唐')) push('tang');
  // 宋：南宋/北宋/宋统一映射 song（当前不在库）
  if (has('南宋') || has('北宋') || has('宋')) push('song');
  if (has('元')) push('yuan');
  if (has('明')) push('ming');
  if (has('清')) push('qing');

  return { codes, answerableCodes: codes.filter(c => ANSWERABLE_DYNASTIES.has(c)) };
}
