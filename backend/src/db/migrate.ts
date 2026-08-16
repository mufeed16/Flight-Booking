import fs from 'fs';
import path from 'path';
import { pool } from './pool';

export async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Migrations applied');
}
