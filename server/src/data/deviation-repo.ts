import type { RowDataPacket } from 'mysql2';
import { dbExecute, getPool } from '../db/mysql.js';
import {
  buildProfile,
  getDeviationProfileMemory,
  recordAnswerMemory,
  resolveDeviationType,
  type DeviationProfile,
} from '../engine/deviation.js';

interface AnswerRow extends RowDataPacket {
  student_id: string;
  question_id: string;
}

/** 确保外键依赖的班级、学生记录存在（幂等）。 */
async function ensureClassAndStudent(studentId: string, classId: string): Promise<boolean> {
  const classOk = await dbExecute(
    'INSERT IGNORE INTO classes (class_id, class_name) VALUES (?, ?)',
    [classId, classId],
  );
  const studentOk = await dbExecute(
    'INSERT IGNORE INTO students (student_id, class_id, display_name) VALUES (?, ?, ?)',
    [studentId, classId, studentId],
  );
  return classOk && studentOk;
}

/** 持久化一条作答到 answer_records；DB 不可用或写入失败时返回 false。 */
async function persistAnswer(
  studentId: string,
  classId: string,
  questionId: string,
  answer: string,
): Promise<boolean> {
  if (!(await ensureClassAndStudent(studentId, classId))) return false;

  return dbExecute(
    `INSERT INTO answer_records
       (student_id, class_id, question_id, answer, is_correct, deviation_type)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [studentId, classId, questionId, answer, resolveDeviationType(questionId)],
  );
}

/**
 * 记录作答：始终写入内存（保证降级路径画像可用）；数据库可用时额外持久化。
 */
export async function recordAnswerAsync(
  studentId: string,
  classId: string,
  questionId: string,
  answer: string,
): Promise<{ persisted: boolean }> {
  recordAnswerMemory(studentId, classId, questionId, answer);

  const pool = await getPool();
  if (!pool) return { persisted: false };

  const ok = await persistAnswer(studentId, classId, questionId, answer);
  return { persisted: ok };
}

/**
 * 获取班级画像：数据库可用时从 answer_records 聚合（权威），否则使用内存数据。
 */
export async function getDeviationProfileAsync(classId: string): Promise<DeviationProfile> {
  const pool = await getPool();
  if (pool) {
    const rows = await new Promise<AnswerRow[] | null>(async resolve => {
      const p = await getPool();
      if (!p) return resolve(null);
      try {
        const [r] = await p.query<AnswerRow[]>(
          'SELECT student_id, question_id FROM answer_records WHERE class_id = ?',
          [classId],
        );
        resolve(r);
      } catch {
        resolve(null);
      }
    });

    if (rows) {
      return buildProfile(
        classId,
        rows.map(r => ({ studentId: r.student_id, questionId: r.question_id })),
      );
    }
  }

  return getDeviationProfileMemory(classId);
}
