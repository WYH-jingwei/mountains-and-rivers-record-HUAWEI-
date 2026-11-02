import { Router } from 'express';
import { getLecturePackage } from '../engine/lecture.js';
import { getAllEntries, fingerprintEntries } from '../data/knowledge.js';
import { cacheGet, cacheSet } from '../db/redis.js';

export const lectureRouter = Router();

lectureRouter.post('/export', async (req, res) => {
  const { dynasty } = req.body as { dynasty: string };

  if (!dynasty) {
    res.status(400).json({ error: '请选择朝代' });
    return;
  }

  // 缓存键带条目指纹：讲解包内容取自条目数据，数据一变旧缓存即失效
  const cacheKey = `lecture:${fingerprintEntries(getAllEntries())}:${dynasty}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const pkg = getLecturePackage(dynasty);
  await cacheSet(cacheKey, pkg, 3600);
  res.json(pkg);
});