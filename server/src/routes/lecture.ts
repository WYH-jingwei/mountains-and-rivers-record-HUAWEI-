import { Router } from 'express';
import { getLecturePackage } from '../engine/lecture.js';
import { cacheGet, cacheSet } from '../db/redis.js';

export const lectureRouter = Router();

lectureRouter.post('/export', async (req, res) => {
  const { dynasty } = req.body as { dynasty: string };

  if (!dynasty) {
    res.status(400).json({ error: '请选择朝代' });
    return;
  }

  const cacheKey = `lecture:${dynasty}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const pkg = getLecturePackage(dynasty);
  await cacheSet(cacheKey, pkg, 3600);
  res.json(pkg);
});