import type { Evidence, MapAction } from '../engine/grader.js';

export interface KnowledgeEntry {
  id: string;
  dynasty: 'tang' | 'ming';
  question: string;
  keywords: string[];
  answer: string;
  evidence: Evidence[];
  caliber: string;
  noConsensus?: boolean;
  mapAction?: MapAction;
}

/** 统一检索结果：命中条目 + 检索分数（关键词打分为整数分，语义检索为余弦相似度）。 */
export interface RetrievalHit {
  entry: KnowledgeEntry;
  score: number;
}

const tangEntries: KnowledgeEntry[] = [
  {
    id: 'tang-01',
    dynasty: 'tang',
    question: '唐朝最西到哪？',
    keywords: ['最西', '西域', '安西', '碎叶'],
    answer: '唐 661 年可核验的直辖范围西至安西都护府所辖碎叶镇（今吉尔吉斯斯坦托克马克），约东经 75°。',
    evidence: [
      { source: '《旧唐书·地理志》', quote: '安西都护府，统碎叶、龟兹、于阗、疏勒四镇', confidence: 'high' },
      { source: '《新唐书·地理志》', quote: '碎叶城，安西四镇之一', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin', focus: [75.3, 42.8] },
  },
  {
    id: 'tang-02',
    dynasty: 'tang',
    question: '唐朝直辖面积多少？',
    keywords: ['面积', '直辖', '944'],
    answer: '按直辖口径（设治州县），唐 661 年约 944 万平方公里。',
    evidence: [
      { source: '《旧唐书·地理志》', quote: '计天下州府三百一十五，县一千五百一十', confidence: 'high' },
      { source: '《元和郡县图志》', quote: '开元二十八年户部帐，凡郡府三百二十八', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin' },
  },
  {
    id: 'tang-03',
    dynasty: 'tang',
    question: '唐朝含羁縻面积多少？',
    keywords: ['羁縻', '面积', '1237', '含羁縻'],
    answer: '若含羁縻府州，唐极盛时约 1237 万平方公里。但羁縻与直辖是两种不同的管辖方式，不能简单相加。',
    evidence: [
      { source: '《新唐书·地理志》', quote: '羁縻州，以别于正州，朝贡无常', confidence: 'high' },
      { source: '《唐会要》卷七十三', quote: '羁縻州府，皆傍塞外，无赋役', confidence: 'high' },
    ],
    caliber: '含羁縻',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin' },
  },
  {
    id: 'tang-04',
    dynasty: 'tang',
    question: '安西四镇是哪四个？',
    keywords: ['安西四镇', '龟兹', '于阗', '疏勒', '碎叶'],
    answer: '安西四镇为龟兹（今库车）、于阗（今和田）、疏勒（今喀什）、碎叶（今托克马克）。碎叶后曾以焉耆替代。',
    evidence: [
      { source: '《旧唐书·地理志》', quote: '安西都护府，统碎叶、龟兹、于阗、疏勒四镇', confidence: 'high' },
      { source: '《新唐书·西域传》', quote: '开元中，焉耆代碎叶为四镇之一', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'tang', year: 661, layer: 'military', focus: [83.0, 41.7] },
  },
  {
    id: 'tang-05',
    dynasty: 'tang',
    question: '唐朝最北到哪？',
    keywords: ['最北', '燕然', '瀚海', '都护府'],
    answer: '唐曾设燕然都护府（后改瀚海、安北），辖漠北，约北纬 50°。但该地区控制时断时续，不能视为稳定直辖。',
    evidence: [
      { source: '《旧唐书·地理志》', quote: '燕然都护府，贞观二十一年置', confidence: 'high' },
      { source: '《新唐书·地理志》', quote: '安北大都护府，龙朔三年改瀚海为安北', confidence: 'medium' },
    ],
    caliber: '羁縻',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin', focus: [105.0, 50.0] },
  },
  {
    id: 'tang-06',
    dynasty: 'tang',
    question: '唐朝羁縻府州有多少？',
    keywords: ['羁縻', '府州', '数量', '800'],
    answer: '唐代羁縻府州约 800 余，主要分布于周边民族地区，朝贡无常、无赋役，与正州性质不同。',
    evidence: [
      { source: '《新唐书·地理志》', quote: '羁縻州，以别于正州', confidence: 'high' },
      { source: '《唐会要》卷七十三', quote: '羁縻州府，皆傍塞外，无赋役', confidence: 'high' },
    ],
    caliber: '羁縻',
  },
  {
    id: 'tang-07',
    dynasty: 'tang',
    question: '唐朝与吐蕃的关系？',
    keywords: ['吐蕃', '西藏', '关系', '会盟'],
    answer: '唐与吐蕃时战时和，曾数次会盟（如 821 年长庆会盟）。吐蕃为独立政权，非唐朝直辖，本系统不将其划入唐疆。',
    evidence: [
      { source: '《旧唐书·吐蕃传》', quote: '吐蕃，在长安西八千里', confidence: 'high' },
      { source: '《新唐书·吐蕃传》', quote: '长庆元年，吐蕃请盟', confidence: 'high' },
    ],
    caliber: '独立政权',
    noConsensus: false,
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin', focus: [91.1, 29.6] },
  },
  {
    id: 'tang-08',
    dynasty: 'tang',
    question: '渤海都督府在哪？',
    keywords: ['渤海', '都督府', '东北', '粟末'],
    answer: '渤海都督府设于粟末靺鞨居地（今吉林、黑龙江一带），属羁縻性质，非直辖。',
    evidence: [
      { source: '《旧唐书·渤海传》', quote: '粟末靺鞨，附于高丽', confidence: 'medium' },
      { source: '《新唐书·渤海传》', quote: '先天二年，拜祚荣为渤海郡王', confidence: 'high' },
    ],
    caliber: '羁縻',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin', focus: [126.0, 44.0] },
  },
  {
    id: 'tang-09',
    dynasty: 'tang',
    question: '单于都护府在哪？',
    keywords: ['单于', '都护府', '内蒙古'],
    answer: '单于都护府设于今内蒙古呼和浩特一带，辖漠南突厥降部，属羁縻性质。',
    evidence: [
      { source: '《旧唐书·地理志》', quote: '单于都护府，麟德元年置', confidence: 'high' },
      { source: '《新唐书·地理志》', quote: '单于大都护府，治云中', confidence: 'medium' },
    ],
    caliber: '羁縻',
    mapAction: { dynasty: 'tang', year: 661, layer: 'admin', focus: [111.7, 40.8] },
  },
  {
    id: 'tang-10',
    dynasty: 'tang',
    question: '玄奘西行路线？',
    keywords: ['玄奘', '西行', '行迹', '天竺'],
    answer: '玄奘于 627 年自长安出发，经凉州、瓜州、伊吾、高昌，沿天山南麓西行过碎叶，南越兴都库什山入天竺。此为行迹到达，非行政管辖。',
    evidence: [
      { source: '《大慈恩寺三藏法师传》', quote: '法师自长安西行，过凉州、瓜州', confidence: 'high' },
      { source: '《大唐西域记》', quote: '自高昌已后，经十六国', confidence: 'high' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'tang', year: 627, layer: 'journey' },
  },
];

const mingEntries: KnowledgeEntry[] = [
  {
    id: 'ming-01',
    dynasty: 'ming',
    question: '明朝最西到哪？',
    keywords: ['最西', '哈密', '西域'],
    answer: '明朝西至哈密卫（今新疆哈密），约东经 93°。哈密以西的别失八里、吐鲁番等先后脱离，明未恢复。',
    evidence: [
      { source: '《明史·西域传》', quote: '哈密卫，永乐四年置', confidence: 'high' },
      { source: '《明实录·永乐朝》', quote: '设哈密卫，以头目为指挥', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin', focus: [93.5, 42.8] },
  },
  {
    id: 'ming-02',
    dynasty: 'ming',
    question: '明朝直辖面积多少？',
    keywords: ['面积', '直辖', '400'],
    answer: '明朝直辖（两京十三布政使司）约 400 万平方公里，远小于唐。明不设羁縻府州体系，周边多为朝贡关系。',
    evidence: [
      { source: '《明史·地理志》', quote: '天下府百四十，州百九十三，县千一百三十八', confidence: 'high' },
      { source: '《大明一统志》', quote: '两京十三布政使司', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin' },
  },
  {
    id: 'ming-03',
    dynasty: 'ming',
    question: '明朝为什么不画北界？',
    keywords: ['北界', '蒙古', '不画', '边界'],
    answer: '明朝北面为蒙古诸部（鞑靼、瓦剌），无稳定行政边界。本系统不画闭合北界——画了就是替历史下结论。',
    evidence: [
      { source: '《明史·鞑靼传》', quote: '鞑靼，元之遗裔也', confidence: 'high' },
      { source: '《明史·瓦剌传》', quote: '瓦剌，在鞑靼西', confidence: 'high' },
    ],
    caliber: '不画',
    noConsensus: true,
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin' },
  },
  {
    id: 'ming-04',
    dynasty: 'ming',
    question: '明朝九边是哪九个？',
    keywords: ['九边', '辽东', '蓟州', '宣府', '大同'],
    answer: '九边为辽东、蓟州、宣府、大同、山西（偏头关）、榆林、宁夏、固原、甘肃九镇，沿长城布防。',
    evidence: [
      { source: '《明史·兵志》', quote: '九边：曰辽东、曰蓟州、曰宣府、曰大同、曰山西、曰榆林、曰宁夏、曰固原、曰甘肃', confidence: 'high' },
      { source: '《大明一统志》', quote: '边镇九处', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'military' },
  },
  {
    id: 'ming-05',
    dynasty: 'ming',
    question: '郑和下西洋到哪？',
    keywords: ['郑和', '下西洋', '行迹', '东非'],
    answer: '郑和七下西洋，最远抵达东非（今索马里、肯尼亚一带）。此为行迹到达，非行政管辖。',
    evidence: [
      { source: '《明史·郑和传》', quote: '和经事三朝，先后七奉使', confidence: 'high' },
      { source: '《瀛涯胜览》', quote: '自占城至忽鲁谟斯，凡二十余国', confidence: 'high' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'ming', year: 1430, layer: 'journey' },
  },
  {
    id: 'ming-06',
    dynasty: 'ming',
    question: '奴儿干都司在哪？',
    keywords: ['奴儿干', '都司', '东北'],
    answer: '奴儿干都司设于黑龙江口（今俄罗斯尼古拉耶夫斯克附近），辖东北女真各卫，属羁縻性质。',
    evidence: [
      { source: '《明史·兵志》', quote: '奴儿干都司，永乐七年置', confidence: 'high' },
      { source: '《明实录·永乐朝》', quote: '设奴儿干都指挥使司', confidence: 'high' },
    ],
    caliber: '羁縻',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin', focus: [140.0, 53.0] },
  },
  {
    id: 'ming-07',
    dynasty: 'ming',
    question: '交趾布政使司？',
    keywords: ['交趾', '安南', '布政使司'],
    answer: '明于 1407 年设交趾布政使司（今越南北部），1427 年撤废。这是明朝唯一一度将东南亚地区纳入直辖的案例。',
    evidence: [
      { source: '《明史·安南传》', quote: '永乐五年，设交趾布政使司', confidence: 'high' },
      { source: '《明实录·宣德朝》', quote: '宣德二年，撤交趾布政使司', confidence: 'high' },
    ],
    caliber: '直辖（短期）',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin', focus: [105.8, 21.0] },
  },
  {
    id: 'ming-08',
    dynasty: 'ming',
    question: '乌思藏都司？',
    keywords: ['乌思藏', '西藏', '都司'],
    answer: '明设乌思藏都指挥使司（今西藏），属羁縻性质，册封当地首领，不派官、不驻军、不征税。',
    evidence: [
      { source: '《明史·西域传》', quote: '乌思藏都指挥使司，洪武初置', confidence: 'high' },
      { source: '《明实录·洪武朝》', quote: '设乌思藏都指挥使司', confidence: 'medium' },
    ],
    caliber: '羁縻',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin', focus: [91.1, 29.6] },
  },
  {
    id: 'ming-09',
    dynasty: 'ming',
    question: '哈密卫的作用？',
    keywords: ['哈密', '卫', '西域', '门户'],
    answer: '哈密卫为明朝西域门户，控制东西交通要道。后为吐鲁番所夺，明朝丧失西域影响力。',
    evidence: [
      { source: '《明史·西域传》', quote: '哈密卫，永乐四年置，为西域门户', confidence: 'high' },
      { source: '《明实录·正德朝》', quote: '哈密为吐鲁番所陷', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin', focus: [93.5, 42.8] },
  },
  {
    id: 'ming-10',
    dynasty: 'ming',
    question: '明朝与蒙古的关系？',
    keywords: ['蒙古', '鞑靼', '瓦剌', '关系'],
    answer: '明与蒙古（鞑靼、瓦剌）长期对峙，时有互市与战争。蒙古为独立政权，明不将其划入疆域。',
    evidence: [
      { source: '《明史·鞑靼传》', quote: '鞑靼，元之遗裔也', confidence: 'high' },
      { source: '《明史·瓦剌传》', quote: '瓦剌，在鞑靼西', confidence: 'high' },
    ],
    caliber: '独立政权',
    mapAction: { dynasty: 'ming', year: 1424, layer: 'admin' },
  },
];

const allEntries: KnowledgeEntry[] = [...tangEntries, ...mingEntries];

/** 关键词打分、过滤与排序（带分数）。数据库加载与内置内存两条路径共用，保证行为一致。 */
export function rankEntriesScored(entries: KnowledgeEntry[], question: string): RetrievalHit[] {
  const q = question.toLowerCase().trim();

  const scored = entries.map(entry => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) score += 2;
    }
    if (entry.question.toLowerCase().includes(q)) score += 5;
    if (q.includes(entry.dynasty)) score += 1;
    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** 兼容旧签名：仅返回条目。需要分数时请使用 rankEntriesScored。 */
export function rankEntries(entries: KnowledgeEntry[], question: string): KnowledgeEntry[] {
  return rankEntriesScored(entries, question).map(h => h.entry);
}

export function searchKnowledge(question: string): KnowledgeEntry[] {
  return rankEntries(allEntries, question);
}

export function getEntriesByDynasty(dynasty: 'tang' | 'ming'): KnowledgeEntry[] {
  return allEntries.filter(e => e.dynasty === dynasty);
}

export function getAllEntries(): KnowledgeEntry[] {
  return allEntries;
}