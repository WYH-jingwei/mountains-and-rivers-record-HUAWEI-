import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let connectFailed = false;
let initialized = false;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function getDbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'history_geo_classroom',
  };
}

/**
 * 获取 MySQL 连接池。
 * 连接失败（未启动/凭据错误/库不存在）时返回 null，由调用方降级到内存实现，不影响主流程。
 */
export async function getPool(): Promise<mysql.Pool | null> {
  if (connectFailed) return null;
  if (pool) return pool;

  const cfg = getDbConfig();
  try {
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 3000,
      charset: 'utf8mb4',
      multipleStatements: false,
    });

    // 用一次真实查询验证连接与库可用性
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();

    initialized = true;
    console.log('MySQL connected:', `${cfg.host}:${cfg.port}/${cfg.database}`);
    return pool;
  } catch (e) {
    connectFailed = true;
    pool = null;
    const code = (e as { code?: string }).code ?? '';
    console.log('MySQL unavailable — running with in-memory data', code ? `(${code})` : '');
    return null;
  }
}

export async function isDbAvailable(): Promise<boolean> {
  return (await getPool()) !== null;
}

/** 参数化查询辅助；DB 不可用或查询出错时返回 null。 */
export async function dbQuery<T = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const [rows] = await p.query(sql, params);
    return rows as T;
  } catch (e) {
    console.error('dbQuery error:', (e as Error).message);
    return null;
  }
}

/** 执行写操作，返回是否成功；DB 不可用或出错时返回 false。 */
export async function dbExecute(sql: string, params: unknown[] = []): Promise<boolean> {
  const p = await getPool();
  if (!p) return false;
  try {
    await p.query(sql, params);
    return true;
  } catch (e) {
    console.error('dbExecute error:', (e as Error).message);
    return false;
  }
}

export function dbInitState(): { initialized: boolean; failed: boolean } {
  return { initialized, failed: connectFailed };
}
