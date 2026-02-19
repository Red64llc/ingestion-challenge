import { getPool } from '../db/client';

export interface Checkpoint {
  cursor: string | null;
  eventsIngested: number;
}

export async function saveCheckpoint(cursor: string | null, eventsIngested: number): Promise<void> {
  const db = await getPool();
  await db.query(`
    INSERT INTO checkpoints (next_cursor, events_ingested)
    VALUES ($1, $2)
  `, [cursor, eventsIngested]);
}

export async function loadCheckpoint(): Promise<Checkpoint | null> {
  const db = await getPool();
  const result = await db.query(`
    SELECT next_cursor, events_ingested
    FROM checkpoints
    ORDER BY id DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return {
    cursor: result.rows[0].next_cursor,
    eventsIngested: parseInt(result.rows[0].events_ingested, 10),
  };
}

export async function clearCheckpoints(): Promise<void> {
  const db = await getPool();
  await db.query('DELETE FROM checkpoints');
}
