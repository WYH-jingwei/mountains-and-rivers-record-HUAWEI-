/**
 * RAG 标定回归：守住检索阈值、RRF 融合与生成护栏的既有结论。
 * 用法：npm run verify:rag（无需启动服务；离线用例始终跑，在线用例需要 .env 里的向量模型配置）。
 */
import { getAllEntriesRepo, searchKnowledgeRepo } from './data/knowledge-repo.js';
import {
  fingerprintEntries,
  normalizeQuery,
  rankEntriesScored,
  type KnowledgeEntry,
} from './data/knowledge.js';
import { semanticSearch } from './rag/vector-store.js';
import { caliberScoreRatio, fuse } from './rag/fusion.js';
import { groundingIssues } from './rag/generator.js';
import { isEmbeddingConfigured } from './llm/client.js';

let pass = 0;
let fail = 0;

function test(name: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
}

/** 次条与首条视为“并列口径”的分数比阈值（与 routes/qa.ts 保持一致）。 */
const MULTI_CALIBER_SCORE_RATIO = 0.93;
/**
 * 阈标定（2026-11-01 在 64 条语料上复测）：同朝代语义真实命中 top1 实测 0.679~0.719；
 * 跨朝代邻近噪声最高 0.588；域外/无关问题最高 0.415。
 * 关键发现：最弱真实命中（绍兴和议 0.679）略低于全局阈值 0.68——语义单路会判为“无命中”，
 * 现由关键词路径经 RRF 兜底救回（见下方“边缘用例”），这也是混合检索必须保留关键词一路的原因。
 */
const TRUE_HIT_MIN = 0.67;
const CROSS_DYNASTY_NOISE_MAX = 0.65;
const OUT_OF_DOMAIN_MAX = 0.59;

const entries = await getAllEntriesRepo();
const byId = (id: string): KnowledgeEntry | undefined => entries.find(e => e.id === id);

console.log('\n========== RAG 标定回归 ==========\n');
console.log(`数据源：${entries.length} 条条目\n`);

// ---------- 1. 数据指纹 ----------
const fp1 = fingerprintEntries(entries);
const fp2 = fingerprintEntries([...entries]);
test('指纹稳定（同数据两次计算结果一致）', fp1 === fp2, fp1);

const tampered = JSON.parse(JSON.stringify(entries)) as KnowledgeEntry[];
tampered[0].answer += '（篡改）';
test(
  '指纹敏感（任一条目内容改动即变化）',
  fingerprintEntries(tampered) !== fp1,
  `${fp1} → ${fingerprintEntries(tampered)}`,
);

// ---------- 2. 关键词路径：口语归一与朝代别称 ----------
test(
  '口语归一：管到 → 直辖',
  normalizeQuery('唐朝管到哪？').includes('直辖'),
  normalizeQuery('唐朝管到哪？'),
);
test(
  '口语归一：羁縻州 → 羁縻',
  normalizeQuery('唐朝羁縻州有多少').includes('羁縻'),
  normalizeQuery('唐朝羁縻州有多少'),
);

const mingHit = rankEntriesScored(entries, '大明疆域有多大？');
const mingCount = entries.filter(e => e.dynasty === 'ming').length;
test(
  '朝代别称加权：大明 → 明',
  mingHit.filter(h => h.entry.dynasty === 'ming').length === mingCount,
  `${mingHit.filter(h => h.entry.dynasty === 'ming').length}/${mingCount} 条明条目进入候选`,
);
const liaosongHit = rankEntriesScored(entries, '辽宋夏金');
test(
  '朝代别称加权：辽宋夏金',
  liaosongHit.filter(h => h.entry.dynasty === 'liaosong').length > 0,
  `${liaosongHit.filter(h => h.entry.dynasty === 'liaosong').length} 条辽宋夏金条目进入候选`,
);
test(
  '关键词路径标注来源',
  mingHit.every(h => h.via === 'keyword' && h.kwScore === h.score),
  `via=${mingHit[0]?.via}`,
);

// ---------- 3. RRF 融合 ----------
const semanticStub = [
  { entry: byId('tang-02')!, score: 0.82, semScore: 0.82, via: 'semantic' as const },
  { entry: byId('tang-01')!, score: 0.70, semScore: 0.70, via: 'semantic' as const },
];
const keywordStub = [
  { entry: byId('tang-02')!, score: 5, kwScore: 5, via: 'keyword' as const },
  { entry: byId('tang-01')!, score: 3, kwScore: 3, via: 'keyword' as const },
];
const fused = fuse(semanticStub, keywordStub, 5);
test(
  'RRF：两路都命中的条目排首且标为 hybrid',
  fused[0].entry.id === 'tang-02' && fused[0].via === 'hybrid',
  `首条=${fused[0].entry.id} (${fused[0].via})`,
);
test(
  'RRF：两路分数都被保留',
  fused[0].semScore === 0.82 && fused[0].kwScore === 5,
  `sem=${fused[0].semScore}, kw=${fused[0].kwScore}`,
);
test(
  'RRF：单路命中仍保留原路径与原始分',
  fused.every(h => h.via === 'hybrid' || h.kwScore != null || h.semScore != null),
);

// ---------- 4. 多口径分数比 ----------
const ratioSemantic = caliberScoreRatio(
  { entry: byId('tang-02')!, score: 0.02, semScore: 0.72 },
  { entry: byId('tang-03')!, score: 0.02, semScore: 0.68 },
);
test(
  '多口径判定：双方有语义分时用余弦比',
  Math.abs(ratioSemantic - 0.68 / 0.72) < 1e-9,
  `比值=${ratioSemantic.toFixed(3)}（阈值 ${MULTI_CALIBER_SCORE_RATIO}）`,
);
const ratioKeyword = caliberScoreRatio(
  { entry: byId('tang-02')!, score: 3, kwScore: 3 },
  { entry: byId('tang-03')!, score: 2, kwScore: 2 },
);
test('多口径判定：纯关键词路径用关键词分比', Math.abs(ratioKeyword - 2 / 3) < 1e-9, `比值=${ratioKeyword.toFixed(3)}`);

// ---------- 5. 生成层事实护栏 ----------
const tangEntries = entries.filter(e => e.dynasty === 'tang');
test(
  '护栏：放行材料内数字',
  groundingIssues('唐 661 年直辖范围西至碎叶，约 944 万平方公里。', '唐朝最西到哪？', tangEntries)
    .length === 0,
);
test(
  '护栏：拦截材料外数字',
  groundingIssues('唐朝最西到咸海，约 1300 万平方公里。', '唐朝最西到哪？', tangEntries).length > 0,
  groundingIssues('唐朝最西到咸海，约 1300 万平方公里。', '唐朝最西到哪？', tangEntries).join('; '),
);
test(
  '护栏：拦截超长输出',
  groundingIssues('唐'.repeat(500), '唐朝最西到哪？', tangEntries).some(i => i.startsWith('超长')),
);

// ---------- 6. 语义标定（在线） ----------
if (!isEmbeddingConfigured()) {
  console.log('\n⚠️ 未配置向量模型（LLM_API_KEY / EMBEDDING_MODEL），跳过在线标定用例\n');
} else {
  const cases: { question: string; dynasty: string; label: string }[] = [
    { question: '唐朝最西到哪？', dynasty: 'tang', label: '唐-最西' },
    { question: '赤壁之战改变了什么？', dynasty: 'sanguo', label: '三国-赤壁' },
    { question: '澶渊之盟约定了什么？', dynasty: 'liaosong', label: '辽宋夏金-澶渊' },
    { question: '绍兴和议划界在哪？', dynasty: 'nansong', label: '南宋-绍兴和议' },
  ];

  for (const c of cases) {
    const hits = await semanticSearch(c.question, 5, 0.45, [c.dynasty]);
    const top = hits[0];
    test(
      `${c.label}：限定朝代的真实命中 top1 ≥ ${TRUE_HIT_MIN}`,
      !!top && top.score >= TRUE_HIT_MIN && top.entry.dynasty === c.dynasty,
      `top1=${top?.entry.id} sem=${top?.score.toFixed(3)}`,
    );
    test(
      `${c.label}：朝代过滤不串朝`,
      hits.every(h => h.entry.dynasty === c.dynasty),
      `${hits.length} 条命中`,
    );
  }

  // 跨朝代邻近噪声：全局检索（不限朝代）时，非目标朝代条目最高分应落在 0.60~0.65 带内且 ≤0.65
  const globalTang = await semanticSearch('唐朝最西到哪？', 64, 0);
  const noise = globalTang
    .filter(h => h.entry.dynasty !== 'tang')
    .reduce((max, h) => Math.max(max, h.score), 0);
  test(
    '跨朝代噪声：非目标朝代最高分 ≤ 0.65',
    noise <= CROSS_DYNASTY_NOISE_MAX,
    `噪声最高=${noise.toFixed(3)}（阈值 ≤${CROSS_DYNASTY_NOISE_MAX}）`,
  );
  test(
    '全局检索：目标朝代仍居首',
    globalTang[0]?.entry.dynasty === 'tang',
    `top1=${globalTang[0]?.entry.id} sem=${globalTang[0]?.score.toFixed(3)}`,
  );

  // 域外问题：全局最高分 ≤0.59，且在全局阈值 0.68 下无命中
  const domainOut = await semanticSearch('罗马帝国的首都是哪座城市？', 64, 0);
  const maxOut = domainOut.reduce((max, h) => Math.max(max, h.score), 0);
  test(
    '域外问题：全局最高分 ≤ 0.59',
    maxOut <= OUT_OF_DOMAIN_MAX,
    `最高=${maxOut.toFixed(3)}（阈值 ≤${OUT_OF_DOMAIN_MAX}）`,
  );
  const atGlobalThreshold = await semanticSearch('罗马帝国的首都是哪座城市？', 5, 0.68);
  test('域外问题：全局阈值 0.68 下无命中', atGlobalThreshold.length === 0, `${atGlobalThreshold.length} 条`);

  // 边缘用例：语义略低于全局阈值，靠关键词路径经 RRF 兜底救回（不触发范围声明）
  const edgeQuestion = '绍兴和议划界在哪？';
  const edgeSemantic = await semanticSearch(edgeQuestion, 5, 0.68);
  const edgeKeyword = await searchKnowledgeRepo(edgeQuestion);
  const edgeFused = fuse(edgeSemantic, edgeKeyword, 5);
  test(
    '边缘用例：语义不过阈值时由关键词兜底',
    edgeFused[0]?.entry.id === 'nansong-01' && edgeFused[0].via !== 'semantic',
    `top1=${edgeFused[0]?.entry.id} (${edgeFused[0]?.via})，语义单路命中 ${edgeSemantic.length} 条`,
  );
}

console.log(`\n========== 结果: ${pass} passed, ${fail} failed ==========\n`);
// Redis/MySQL 连接会保持事件循环，脚本需显式退出
process.exit(fail > 0 ? 1 : 0);
