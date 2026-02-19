import { Pool } from 'pg';
import { config } from '../config';
import { Event } from '../api/types';

let pool: Pool | null = null;

function getAdminConnectionString(): string {
  // Replace the database name with 'postgres' to connect to the default database
  const url = new URL(config.databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function getDatabaseName(): string {
  const url = new URL(config.databaseUrl);
  return url.pathname.slice(1); // Remove leading '/'
}

async function ensureDatabase(): Promise<void> {
  const dbName = getDatabaseName();
  const adminPool = new Pool({
    connectionString: getAdminConnectionString(),
  });

  try {
    // Check if database exists
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create database
      console.log(`Creating database '${dbName}'...`);
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
    });
  }
  return pool;
}

export async function initDatabase(): Promise<void> {
  // Ensure database exists first
  await ensureDatabase();

  const db = await getPool();

  // Create ingested_events table with full event data
  await db.query(`
    CREATE TABLE IF NOT EXISTS ingested_events (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(36),
      user_id VARCHAR(36),
      type VARCHAR(50),
      name VARCHAR(100),
      properties JSONB,
      timestamp BIGINT,
      device_type VARCHAR(50),
      browser VARCHAR(50)
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

export async function batchInsertEvents(events: Event[]): Promise<void> {
  if (events.length === 0) return;

  const db = await getPool();

  // Build values for batch insert
  const values: unknown[] = [];
  const placeholders: string[] = [];

  events.forEach((event, i) => {
    const offset = i * 9;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
    values.push(
      event.id,
      event.sessionId,
      event.userId,
      event.type,
      event.name,
      JSON.stringify(event.properties),
      typeof event.timestamp === 'number' ? event.timestamp : Date.parse(event.timestamp),
      event.session?.deviceType || null,
      event.session?.browser || null
    );
  });

  await db.query(`
    INSERT INTO ingested_events (id, session_id, user_id, type, name, properties, timestamp, device_type, browser)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO NOTHING
  `, values);
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
