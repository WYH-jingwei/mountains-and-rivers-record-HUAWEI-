import express from 'express';
import cors from 'cors';
import { qaRouter } from './routes/qa.js';
import { lectureRouter } from './routes/lecture.js';
import { deviationRouter } from './routes/deviation.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/qa', qaRouter);
app.use('/api/lecture', lectureRouter);
app.use('/api/deviation', deviationRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});