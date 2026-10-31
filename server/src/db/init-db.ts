import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbConfig } from './mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlDir = path.join(__dirname, '../../sql');

async function main(): Promise<void> {
  const cfg = getDbConfig();

  // 初始化阶段不指定 database（schema.sql 内含 CREATE DATABASE / USE），并允许多语句
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: true,
    connectTimeout: 5000,
  });

  const schemaSql = fs.readFileSync(path.join(sqlDir, 'schema.sql'), 'utf8');
  const seedSql = fs.readFileSync(path.join(sqlDir, 'seed-data.sql'), 'utf8');

  console.log('→ 执行 schema.sql ...');
  await conn.query(schemaSql);
  console.log('→ 执行 seed-data.sql ...');
  await conn.query(seedSql);

  await conn.end();
  console.log(`\n✅ 数据库初始化完成: ${cfg.host}:${cfg.port}/${cfg.database}`);
}

main().catch(e => {
  console.error('\n❌ 数据库初始化失败:', e.code ? `${e.code} - ` : '', e.message);
  process.exit(1);
});
