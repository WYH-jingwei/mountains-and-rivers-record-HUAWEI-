import { Router } from 'express';
import {
  getDeviationProfileAsync,
  recordAnswerAsync,
} from '../data/deviation-repo.js';

export const deviationRouter = Router();

deviationRouter.get('/class/:classId', async (req, res) => {
  const { classId } = req.params;
  const profile = await getDeviationProfileAsync(classId);
  res.json(profile);
});

deviationRouter.post('/answer', async (req, res) => {
  const { studentId, classId, questionId, answer } = req.body as {
    studentId: string;
    classId: string;
    questionId: string;
    answer: string;
  };

  if (!studentId || !classId || !questionId) {
    res.status(400).json({ error: '缺少必要字段 studentId/classId/questionId' });
    return;
  }

  const { persisted } = await recordAnswerAsync(studentId, classId, questionId, answer ?? '');
  res.json({ status: 'recorded', persisted });
});
