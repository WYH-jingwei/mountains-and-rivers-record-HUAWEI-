import express from 'express';
import cors from 'cors';
import { qaRouter } from './routes/qa.js';
import { lectureRouter } from './routes/lecture.js';
import { deviationRouter } from './routes/deviation.js';
import { getPool } from './db/mysql.js';
import http from 'http';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/qa', qaRouter);
app.use('/api/lecture', lectureRouter);
app.use('/api/deviation', deviationRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = 3001;
const server = app.listen(PORT, async () => {
  console.log(`\n✅ 后端服务启动: http://localhost:${PORT}`);
  console.log('\n========== 开始验证 ==========\n');

  let pass = 0, fail = 0;

  function test(name: string, ok: boolean, detail?: string) {
    const mark = ok ? '✅' : '❌';
    console.log(`${mark} ${name}${detail ? ' — ' + detail : ''}`);
    ok ? pass++ : fail++;
  }

  function post(path: string, body: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(`http://localhost:${PORT}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let buf = '';
        res.on('data', (chunk) => buf += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  function get(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}${path}`, (res) => {
        let buf = '';
        res.on('data', (chunk) => buf += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
        });
      }).on('error', reject);
    });
  }

  // 1. Health
  try {
    const h = await get('/api/health');
    test('健康检查', h.status === 'ok');
  } catch (e) {
    test('健康检查', false, (e as Error).message);
  }

  // 2. QA - 直答
  try {
    const r = await post('/api/qa', { question: '唐朝最西到哪？' });
    test('QA直答 (Level 1)', r.level === 1, `level=${r.level}, answer=${r.answer?.substring(0, 30)}...`);
    test('QA直答 - 有出处', r.evidence?.length > 0, `${r.evidence?.length} 条出处`);
    test('QA直答 - 有地图动作', !!r.mapAction, `layer=${r.mapAction?.layer}`);
    test(
      'QA直答 - 检索溯源',
      !!r.retrieval?.hits?.length && !!r.retrieval?.rationale,
      `首条=${r.retrieval?.hits?.[0]?.id} (${r.retrieval?.hits?.[0]?.via})`,
    );
  } catch (e) {
    test('QA直答', false, (e as Error).message);
  }

  // 3. QA - 条件答
  try {
    const r = await post('/api/qa', { question: '唐朝面积多少？' });
    test('QA条件答', r.level >= 1, `level=${r.level}`);
  } catch (e) {
    test('QA条件答', false, (e as Error).message);
  }

  // 4. QA - 范围声明（与本系统史料无涉的问题应明确作答：超出范围）
  try {
    const r = await post('/api/qa', { question: '罗马帝国的首都是哪座城市？' });
    test('QA范围声明 (Level 3)', r.level === 3, `level=${r.level}, answer=${r.answer?.substring(0, 20)}...`);
  } catch (e) {
    test('QA范围声明', false, (e as Error).message);
  }

  // 4b. QA - 扩池朝代（三国/辽宋夏金/南宋）
  try {
    const r1 = await post('/api/qa', { question: '赤壁之战改变了什么？' });
    test('扩池-三国', r1.level >= 1 && r1.mapAction?.dynasty === 'sanguo', `level=${r1.level}, dynasty=${r1.mapAction?.dynasty}`);
    const r2 = await post('/api/qa', { question: '澶渊之盟约定了什么？' });
    test('扩池-辽宋夏金', r2.level >= 1 && r2.mapAction?.dynasty === 'liaosong', `level=${r2.level}, dynasty=${r2.mapAction?.dynasty}`);
    const r3 = await post('/api/qa', { question: '绍兴和议划界在哪？' });
    test('扩池-南宋', r3.level >= 1 && r3.mapAction?.dynasty === 'nansong', `level=${r3.level}, dynasty=${r3.mapAction?.dynasty}`);
  } catch (e) {
    test('扩池朝代', false, (e as Error).message);
  }

  // 5. Lecture - 唐朝
  try {
    const r = await post('/api/lecture/export', { dynasty: 'tang' });
    test('讲解包-唐 - 地图切片', r.maps?.length > 0, `${r.maps?.length} 个切片`);
    test('讲解包-唐 - 课堂问题', r.questions?.length > 0, `${r.questions?.length} 个问题`);
    test('讲解包-唐 - 出处卡片', r.evidenceCards?.length > 0, `${r.evidenceCards?.length} 张卡片`);
  } catch (e) {
    test('讲解包-唐', false, (e as Error).message);
  }

  // 6. Lecture - 明朝
  try {
    const r = await post('/api/lecture/export', { dynasty: 'ming' });
    test('讲解包-明 - 地图切片', r.maps?.length > 0, `${r.maps?.length} 个切片`);
    test('讲解包-明 - 课堂问题', r.questions?.length > 0, `${r.questions?.length} 个问题`);
  } catch (e) {
    test('讲解包-明', false, (e as Error).message);
  }

  // 6b. Lecture - 南宋（扩池朝代）
  try {
    const r = await post('/api/lecture/export', { dynasty: 'nansong' });
    test('讲解包-南宋 - 朝代名', r.dynasty === '南宋', `dynasty=${r.dynasty}`);
    test('讲解包-南宋 - 课堂问题', r.questions?.length > 0, `${r.questions?.length} 个问题`);
  } catch (e) {
    test('讲解包-南宋', false, (e as Error).message);
  }

  // 7. Deviation - 记录作答（先清理 demo-class 历史作答，保证 verify 幂等、不随运行次数累积）
  try {
    const pool = await getPool();
    if (pool) await pool.query("DELETE FROM answer_records WHERE class_id = 'demo-class'");
  } catch (e) {
    console.error('reset demo-class failed:', (e as Error).message);
  }
  try {
    const r1 = await post('/api/deviation/answer', { studentId: 's1', classId: 'demo-class', questionId: 'tang-q1', answer: '唐朝管到咸海' });
    test('偏差-记录作答1', r1.status === 'recorded');
    const r2 = await post('/api/deviation/answer', { studentId: 's2', classId: 'demo-class', questionId: 'tang-q2', answer: '唐朝管到咸海' });
    test('偏差-记录作答2', r2.status === 'recorded');
    const r3 = await post('/api/deviation/answer', { studentId: 's3', classId: 'demo-class', questionId: 'tang-q5', answer: '唐朝管到贝加尔湖' });
    test('偏差-记录作答3', r3.status === 'recorded');
  } catch (e) {
    test('偏差-记录作答', false, (e as Error).message);
  }

  // 8. Deviation - 查询画像
  try {
    const r = await get('/api/deviation/class/demo-class');
    test('偏差画像 - 总作答数', r.totalAnswers >= 3, `${r.totalAnswers} 条`);
    test('偏差画像 - 学生数', r.totalStudents >= 2, `${r.totalStudents} 人`);
    test('偏差画像 - 偏差分布', r.deviations?.length > 0, `${r.deviations?.length} 种偏差`);
    if (r.deviations?.length > 0) {
      test('偏差画像 - 主要偏差类型', r.deviations[0].type === '管到/写到混淆', r.deviations[0].type);
      test('偏差画像 - 教学建议', !!r.deviations[0].suggestion, r.deviations[0].suggestion?.substring(0, 30));
    }
    test('偏差画像 - 总结', !!r.summary, r.summary?.substring(0, 40));
  } catch (e) {
    test('偏差画像', false, (e as Error).message);
  }

  console.log(`\n========== 结果: ${pass} passed, ${fail} failed ==========`);
  console.log('\n✅ 后端服务运行中: http://localhost:3001');
  console.log('   API 端点:');
  console.log('   - GET  /api/health');
  console.log('   - POST /api/qa              body: { question }');
  console.log('   - POST /api/lecture/export  body: { dynasty: "tang"|"ming" }');
  console.log('   - POST /api/deviation/answer body: { studentId, classId, questionId, answer }');
  console.log('   - GET  /api/deviation/class/:classId');
  console.log('\n⏳ 服务保持运行，按 Ctrl+C 停止...');

  // 保持服务运行
  process.on('SIGINT', () => {
    console.log('\n服务停止');
    server.close();
    process.exit(0);
  });
});