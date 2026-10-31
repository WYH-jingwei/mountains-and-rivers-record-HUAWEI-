import express from 'express';
import cors from 'cors';
import { qaRouter } from './routes/qa.js';
import { lectureRouter } from './routes/lecture.js';
import { deviationRouter } from './routes/deviation.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/qa', qaRouter);
app.use('/api/lecture', lectureRouter);
app.use('/api/deviation', deviationRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 同时服务前端静态文件
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = 3001;
const server = app.listen(PORT, async () => {
  console.log(`\n✅ 服务启动: http://localhost:${PORT}`);
  console.log(`   前端页面: http://localhost:${PORT}/`);
  console.log(`   地图端:   http://localhost:${PORT}/map`);
  console.log(`   教师端:   http://localhost:${PORT}/teach`);
  console.log(`   学生端:   http://localhost:${PORT}/learn`);
  console.log(`   API:      http://localhost:${PORT}/api/...`);
  console.log('\n按 Ctrl+C 停止服务');
});

process.on('SIGINT', () => {
  console.log('\n服务停止');
  server.close();
  process.exit(0);
});