import type { Evidence, MapAction } from '../engine/grader.js';

export interface KnowledgeEntry {
  id: string;
  /** 朝代拼音代码（tang/ming/qin/xihan/sui/yuan/qing 等），与地图 focusOnAction 代码表一致。 */
  dynasty: string;
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

// ===== 扩充条目：秦 / 西汉 / 东汉 / 隋 / 元 / 清（2026-10-31 阶段1）=====
const expandedEntries: KnowledgeEntry[] = [
  // ---------- 秦 ----------
  {
    id: 'qin-01',
    dynasty: 'qin',
    question: '秦朝疆域四至到哪？',
    keywords: ['疆域', '四至', '临洮', '辽东', '秦'],
    answer: '秦统一后疆域东至海暨朝鲜，西至临洮、羌中，南至北向户，北据河为塞并阴山至辽东，是中国第一个大一统中央集权王朝。',
    evidence: [
      { source: '《史记·秦始皇本纪》', quote: '地东至海暨朝鲜，西至临洮、羌中，南至北向户，北据河为塞，并阴山至辽东', confidence: 'high' },
      { source: '《史记·秦始皇本纪》', quote: '分天下以为三十六郡，郡置守、尉、监', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'qin', year: -221, layer: 'admin', focus: [108.95, 34.27] },
  },
  {
    id: 'qin-02',
    dynasty: 'qin',
    question: '秦朝面积有多大？',
    keywords: ['面积', '秦', '340'],
    answer: '秦朝疆域面积约 340 万平方公里（地图内置口径），此后历代疆域在此基础上伸缩。',
    evidence: [
      { source: '《史记·秦始皇本纪》', quote: '分天下以为三十六郡', confidence: 'high' },
      { source: '《汉书·地理志》', quote: '秦遂并兼四海，分天下为郡县', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'qin', year: -221, layer: 'admin' },
  },
  {
    id: 'qin-03',
    dynasty: 'qin',
    question: '秦朝为什么推行郡县制？',
    keywords: ['郡县制', '中央集权', '不立诸子', '郡县'],
    answer: '秦废分封、行郡县，全国置三十六郡（后增至四十余郡），长官由中央任免、不封诸子为王，奠定后世地方行政制度。',
    evidence: [
      { source: '《史记·秦始皇本纪》', quote: '分天下以为三十六郡，郡置守、尉、监', confidence: 'high' },
      { source: '《史记·李斯列传》', quote: '置诸侯不便，皆为郡县', confidence: 'medium' },
    ],
    caliber: '制度',
    mapAction: { dynasty: 'qin', year: -221, layer: 'admin', focus: [108.95, 34.27] },
  },
  // ---------- 西汉 ----------
  {
    id: 'xihan-01',
    dynasty: 'xihan',
    question: '西汉疆域有多大？',
    keywords: ['西汉', '疆域', '四至', '西域都护', '609'],
    answer: '西汉宣帝极盛时东到乐浪、西逾葱岭、南抵日南、北据漠南，文献口径约 609 万平方公里；前60年设西域都护府是西域纳入中央管辖的标志。',
    evidence: [
      { source: '《汉书·地理志》', quote: '武帝攘却胡越，开地斥境', confidence: 'medium' },
      { source: '《汉书·西域传》', quote: '西域以孝武时始通，本三十六国', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'xihan', year: -50, layer: 'admin', focus: [108.95, 34.27] },
  },
  {
    id: 'xihan-02',
    dynasty: 'xihan',
    question: '西域都护府是谁设立的？',
    keywords: ['西域都护', '郑吉', '乌垒', '宣帝', '都护府'],
    answer: '汉宣帝神爵二年（前60）任命郑吉为西域都护，幕府治乌垒城（今新疆轮台），统辖西域诸国，标志新疆地区正式纳入中央政权版图。',
    evidence: [
      { source: '《汉书·郑吉传》', quote: '汉之号令班西域矣，始自张骞而成于郑吉', confidence: 'high' },
      { source: '《汉书·西域传》', quote: '乃因使吉并护北道，故号曰都护。都护之起，自吉置矣', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'xihan', year: -60, layer: 'military', focus: [85.0, 41.7] },
  },
  {
    id: 'xihan-03',
    dynasty: 'xihan',
    question: '张骞通西域是怎么回事？',
    keywords: ['张骞', '出使', '凿空', '西域', '行迹'],
    answer: '张骞于前138、前119年两度出使西域，前后十三年，"凿空"贯通丝绸之路。此为人物行迹与外交到达，不等于行政管辖。',
    evidence: [
      { source: '《汉书·张骞传》', quote: '骞以郎应募，使月氏', confidence: 'high' },
      { source: '《汉书·张骞传》', quote: '于是西北国始通于汉矣，然张骞凿空', confidence: 'high' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'xihan', year: -138, layer: 'journey', figure: '张骞', focus: [108.95, 34.27] },
  },
  {
    id: 'xihan-04',
    dynasty: 'xihan',
    question: '河西四郡是哪四个？',
    keywords: ['河西四郡', '武威', '张掖', '酒泉', '敦煌'],
    answer: '汉武帝在河西走廊先后置武威、张掖、酒泉、敦煌四郡，据两关（阳关、玉门关），隔断羌胡、打通西域通道，属中央直辖。',
    evidence: [
      { source: '《汉书·西域传》', quote: '初置酒泉郡，分置武威、张掖、敦煌，列四郡，据两关焉', confidence: 'high' },
      { source: '《汉书·武帝纪》', quote: '元鼎六年，分武威、酒泉地置张掖、敦煌郡', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'xihan', year: -111, layer: 'military', focus: [94.66, 40.14] },
  },
  // ---------- 东汉 ----------
  {
    id: 'donghan-01',
    dynasty: 'donghan',
    question: '班超是怎样经营西域的？',
    keywords: ['班超', '西域', '都护', '不入虎穴', '行迹'],
    answer: '班超在西域三十一年，平定鄯善、于阗、疏勒，重开西域都护府，使西域五十余国归附。其功业含人物行迹，都护府则为正式管辖。',
    evidence: [
      { source: '《后汉书·班超传》', quote: '不入虎穴，不得虎子', confidence: 'high' },
      { source: '《后汉书·班超传》', quote: '超之所绥，西域五十余国悉皆纳质内属', confidence: 'medium' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'donghan', year: 91, layer: 'journey', figure: '班超', focus: [82.96, 41.63] },
  },
  {
    id: 'donghan-02',
    dynasty: 'donghan',
    question: '东汉疆域和西域控制情况如何？',
    keywords: ['东汉', '疆域', '西域', '三绝三通', '580'],
    answer: '东汉疆域约 580 万平方公里（文献口径），西域都护时置时废，史称"三绝三通"，总体控制略弱于西汉。',
    evidence: [
      { source: '《后汉书·西域传》', quote: '自建武至于延光，西域三绝三通', confidence: 'high' },
      { source: '《后汉书·郡国志》', quote: '世祖中兴，四海之内莫不向化', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'donghan', year: 91, layer: 'admin', focus: [112.45, 34.62] },
  },
  {
    id: 'donghan-03',
    dynasty: 'donghan',
    question: '甘英出使大秦到了哪里？',
    keywords: ['甘英', '大秦', '条支', '临大海', '行迹'],
    answer: '永元九年（97）班超遣甘英出使大秦（罗马），抵条支临大海（波斯湾）而还，是汉代官方西行最远的记录，属行迹到达、未设治。',
    evidence: [
      { source: '《后汉书·西域传》', quote: '和帝永元九年，都护班超遣甘英使大秦，抵条支', confidence: 'high' },
      { source: '《后汉书·西域传》', quote: '临大海欲度，英闻之乃止', confidence: 'high' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'donghan', year: 97, layer: 'journey', figure: '甘英', focus: [48.0, 30.0] },
  },
  // ---------- 隋 ----------
  {
    id: 'sui-01',
    dynasty: 'sui',
    question: '隋朝疆域有多大？',
    keywords: ['隋', '疆域', '吐谷浑', '且末', '五原', '467'],
    answer: '隋大业五年平定吐谷浑、置四郡，"东南皆至于海，西至且末，北至五原"，极盛约 467 万平方公里，是再度统一的承上启下王朝。',
    evidence: [
      { source: '《隋书·地理志》', quote: '五年，平定吐谷浑，更置四郡，东南皆至于海，西至且末，北至五原，隋氏之盛，极于此也', confidence: 'high' },
      { source: '《隋书·炀帝纪》', quote: '地广三代，威振八纮', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'sui', year: 609, layer: 'admin', focus: [112.45, 34.62] },
  },
  {
    id: 'sui-02',
    dynasty: 'sui',
    question: '隋朝大运河是怎样的工程？',
    keywords: ['大运河', '通济渠', '炀帝', '漕运', '运河'],
    answer: '隋炀帝开凿以洛阳为中心、北达涿郡、南至余杭的大运河，沟通五大水系，是工程与交通建设，非疆域扩张。',
    evidence: [
      { source: '《隋书·炀帝纪》', quote: '发河南诸郡男女万馀，开通济渠', confidence: 'high' },
      { source: '《元和郡县图志》', quote: '自板渚引河，通于淮、泗', confidence: 'medium' },
    ],
    caliber: '工程',
    mapAction: { dynasty: 'sui', year: 605, layer: 'cultural', focus: [112.45, 34.62] },
  },
  // ---------- 元 ----------
  {
    id: 'yuan-01',
    dynasty: 'yuan',
    question: '元朝疆域有多大？',
    keywords: ['元', '疆域', '北逾阴山', '西极流沙', '1372'],
    answer: '元朝疆域"北逾阴山，西极流沙，东尽辽左，南越海表"，极盛约 1372 万平方公里，幅员为历代之最，以行省制管理辽阔疆土。',
    evidence: [
      { source: '《元史·地理志》', quote: '故其地北逾阴山，西极流沙，东尽辽左，南越海表', confidence: 'high' },
      { source: '《元史·地理志》', quote: '若元，起朔漠，并西域，平西夏，而天下为一', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'yuan', year: 1310, layer: 'admin', focus: [116.4, 39.9] },
  },
  {
    id: 'yuan-02',
    dynasty: 'yuan',
    question: '元朝行省制度是怎样的？',
    keywords: ['行省', '中书省', '十省', '地方制度'],
    answer: '元在中央设中书省、地方设十大行中书省（岭北、辽阳、河南、陕西、四川、甘肃、云南、江浙、江西、湖广），行省制为后世省级行政区划源头。',
    evidence: [
      { source: '《元史·百官志》', quote: '行中书省，掌国庶务，统郡县，镇边鄙', confidence: 'high' },
      { source: '《元史·地理志》', quote: '立中书省一，行中书省十有一', confidence: 'medium' },
    ],
    caliber: '制度',
    mapAction: { dynasty: 'yuan', year: 1310, layer: 'admin', focus: [116.4, 39.9] },
  },
  {
    id: 'yuan-03',
    dynasty: 'yuan',
    question: '宣政院如何管理吐蕃？',
    keywords: ['宣政院', '吐蕃', '西藏', '帝师', '释教'],
    answer: '元设宣政院，"掌释教僧徒及吐蕃诸族之事"，在吐蕃郡县其地、设官分职，西藏自此由中央政权直接管辖，是西藏纳入中国行政体系的重要节点。',
    evidence: [
      { source: '《元史·百官志》', quote: '宣政院，掌释教僧徒及吐蕃诸族之事', confidence: 'high' },
      { source: '《元史·释老传》', quote: '乃郡县土番之地，设官分职，而领之于帝师', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'yuan', year: 1288, layer: 'admin', focus: [91.1, 29.6] },
  },
  {
    id: 'yuan-04',
    dynasty: 'yuan',
    question: '马可·波罗来华是怎么回事？',
    keywords: ['马可·波罗', '马可波罗', '行纪', '意大利', '行迹'],
    answer: '意大利人马可·波罗元代来华、留居十余年，归国后口述《马可·波罗行纪》向欧洲介绍中国。此为域外人物行迹，非元朝管辖范围。',
    evidence: [
      { source: '《马可·波罗行纪》', quote: '君临此地的是大汗', confidence: 'medium' },
      { source: '《元史·世祖纪》', quote: '远人来贡，厚赐以遣之', confidence: 'low' },
    ],
    caliber: '行迹',
    mapAction: { dynasty: 'yuan', year: 1280, layer: 'journey', focus: [116.4, 39.9] },
  },
  // ---------- 清 ----------
  {
    id: 'qing-01',
    dynasty: 'qing',
    question: '清朝疆域有多大？',
    keywords: ['清', '疆域', '乾隆', '极盛', '1316'],
    answer: '清朝乾隆平定准噶尔、统一新疆后，西跨葱岭、北接西伯利亚、东到东海、南抵南海，极盛约 1316 万平方公里，奠定现代中国版图基础。',
    evidence: [
      { source: '《清史稿·地理志》', quote: '东极三姓所属库页岛，西极新疆疏勒至于葱岭，北极外兴安岭，南极广东琼州之崖山', confidence: 'high' },
      { source: '《清史稿·高宗纪》', quote: '平准夷，定回部', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'qing', year: 1759, layer: 'admin', focus: [116.4, 39.9] },
  },
  {
    id: 'qing-02',
    dynasty: 'qing',
    question: '伊犁将军是什么官职？',
    keywords: ['伊犁将军', '明瑞', '新疆', '军府', '屯田'],
    answer: '乾隆二十七年（1762）设"总统伊犁等处将军"，首任明瑞，节制天山南北、统辖外夷、广辟屯田，是清廷在新疆的最高军政长官，新疆实行军府制。',
    evidence: [
      { source: '《清史稿·职官志》', quote: '伊犁将军，掌新疆之军政，山北山南皆听节制', confidence: 'high' },
      { source: '《清史稿·高宗纪》', quote: '明瑞为伊犁将军', confidence: 'medium' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'qing', year: 1762, layer: 'military', focus: [81.3, 43.9] },
  },
  {
    id: 'qing-03',
    dynasty: 'qing',
    question: '清朝如何治理西藏？',
    keywords: ['驻藏大臣', '达赖', '班禅', '理藩院', '西藏'],
    answer: '清先后册封达赖喇嘛（1653）、班禅额尔德尼（1713），并设驻藏大臣代表中央督办藏务，西藏政教事务纳入中央主权管辖。',
    evidence: [
      { source: '《清史稿·藩部传》', quote: '封为班禅额尔德尼，颁发金印、金册', confidence: 'high' },
      { source: '《清史稿·职官志》', quote: '驻藏大臣，掌西藏之政令', confidence: 'high' },
    ],
    caliber: '直辖',
    mapAction: { dynasty: 'qing', year: 1727, layer: 'admin', focus: [91.1, 29.6] },
  },
  {
    id: 'qing-04',
    dynasty: 'qing',
    question: '雅克萨之战和尼布楚条约是怎么回事？',
    keywords: ['雅克萨', '尼布楚', '条约', '康熙', '俄罗斯'],
    answer: '康熙两次发起雅克萨自卫反击战，1689年与沙俄签订《尼布楚条约》，以格尔必齐河、额尔古纳河为界，是中国与西方国家订立的第一个国际条约，明确了东段边界。',
    evidence: [
      { source: '《清史稿·邦交志》', quote: '二十八年冬十二月，与俄定黑龙江界，立约七条', confidence: 'high' },
      { source: '《清史稿·圣祖纪》', quote: '命索额图等赴尼布楚，与鄂罗斯定边界', confidence: 'medium' },
    ],
    caliber: '条约',
    mapAction: { dynasty: 'qing', year: 1689, layer: 'military', focus: [124.1, 52.4] },
  },
];

const allEntries: KnowledgeEntry[] = [...tangEntries, ...mingEntries, ...expandedEntries];

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

export function getEntriesByDynasty(dynasty: string): KnowledgeEntry[] {
  return allEntries.filter(e => e.dynasty === dynasty);
}

export function getAllEntries(): KnowledgeEntry[] {
  return allEntries;
}