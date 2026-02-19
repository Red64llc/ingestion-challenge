import { Pool } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
    });
  }
  return pool;
}

export async function initDatabase(): Promise<void> {
  const db = await getPool();

  // Create ingested_events table (simplified - only store IDs)
  await db.query(`
    CREATE TABLE IF NOT EXISTS ingested_events (
      id VARCHAR(36) PRIMARY KEY
    )
  `);

  // Create checkpoints table for resumability
  await db.query(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id SERIAL PRIMARY KEY,
      next_cursor TEXT,
      events_ingested INTEGER,
      last_updated TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('Database initialized');
}

export async function batchInsertIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const db = await getPool();
  await db.query(`
    INSERT INTO ingested_events (id)
    SELECT UNNEST($1::varchar[])
    ON CONFLICT DO NOTHING
  `, [ids]);
}

export async function getEventCount(): Promise<number> {
  const db = await getPool();
  const result = await db.query('SELECT COUNT(*) as count FROM ingested_events');
  return parseInt(result.rows[0].count, 10);
}

export async function getAllEventIds(): Promise<string[]> {
  const db = await getPool();
  const result = await db.query('SELECT id FROM ingested_events ORDER BY id');
  return result.rows.map(row => row.id);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
