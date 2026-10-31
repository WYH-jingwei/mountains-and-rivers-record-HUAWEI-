import type { RowDataPacket } from 'mysql2';
import { dbQuery } from '../db/mysql.js';
import {
  getAllEntries,
  rankEntriesScored,
  type KnowledgeEntry,
  type RetrievalHit,
} from './knowledge.js';
import type { Evidence, MapAction } from '../engine/grader.js';

interface EntryRow extends RowDataPacket {
  id: string;
  dynasty: string;
  question: string;
  keywords: string | string[];
  answer: string;
  caliber: string;
  no_consensus: number;
}

interface EvidenceRow extends RowDataPacket {
  entry_id: string;
  source: string;
  quote: string;
  confidence: 'high' | 'medium' | 'low';
}

interface MapActionRow extends RowDataPacket {
  entry_id: string;
  dynasty: string;
  year: number | null;
  layer: MapAction['layer'];
  focus_lng: number | null;
  focus_lat: number | null;
}

/** 从 MySQL 加载并组装全部知识条目；DB 不可用或查询失败时返回 null。 */
async function loadEntriesFromDb(): Promise<KnowledgeEntry[] | null> {
  const entryRows = await dbQuery<EntryRow[]>('SELECT * FROM knowledge_entries');
  if (!entryRows) return null;

  const evidenceRows = await dbQuery<EvidenceRow[]>(
    'SELECT entry_id, source, quote, confidence FROM evidence ORDER BY sort_order, id',
  );
  const actionRows = await dbQuery<MapActionRow[]>('SELECT * FROM map_actions');
  if (!evidenceRows || !actionRows) return null;

  return entryRows.map(row => {
    let keywords: string[];
    try {
      keywords = Array.isArray(row.keywords) ? row.keywords : JSON.parse(row.keywords);
    } catch {
      keywords = [];
    }

    const evidence: Evidence[] = evidenceRows
      .filter(ev => ev.entry_id === row.id)
      .map(ev => ({ source: ev.source, quote: ev.quote, confidence: ev.confidence }));

    const action = actionRows.find(a => a.entry_id === row.id);
    let mapAction: MapAction | undefined;
    if (action) {
      mapAction = {
        dynasty: action.dynasty,
        layer: action.layer,
        ...(action.year !== null ? { year: action.year } : {}),
        ...(action.focus_lng !== null && action.focus_lat !== null
          ? { focus: [Number(action.focus_lng), Number(action.focus_lat)] as [number, number] }
          : {}),
      };
    }

    return {
      id: row.id,
      dynasty: row.dynasty,
      question: row.question,
      keywords,
      answer: row.answer,
      evidence,
      caliber: row.caliber,
      noConsensus: !!row.no_consensus,
      mapAction,
    };
  });
}

/**
 * 检索知识：优先使用 MySQL 中的数据；DB 不可用时降级到内置内存条目。
 * 两条路径共用同一套打分排序规则。
 */
export async function searchKnowledgeRepo(question: string): Promise<RetrievalHit[]> {
  const dbEntries = await loadEntriesFromDb();
  if (dbEntries) return rankEntriesScored(dbEntries, question);
  return rankEntriesScored(getAllEntries(), question);
}

/** 取全部知识条目（数据库优先，无库时用内置内存），用于构建向量库。 */
export async function getAllEntriesRepo(): Promise<KnowledgeEntry[]> {
  const dbEntries = await loadEntriesFromDb();
  return dbEntries ?? getAllEntries();
}
