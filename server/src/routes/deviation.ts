import { Router } from 'express';
import { getDeviationProfile, recordAnswer } from '../engine/deviation.js';

export const deviationRouter = Router();

deviationRouter.get('/class/:classId', async (req, res) => {
  const { classId } = req.params;
  const profile = getDeviationProfile(classId);
  res.json(profile);
});

deviationRouter.post('/answer', async (req, res) => {
  const { studentId, classId, questionId, answer } = req.body as {
    studentId: string;
    classId: string;
    questionId: string;
    answer: string;
  };

  recordAnswer(studentId, classId, questionId, answer);
  res.json({ status: 'recorded' });
});