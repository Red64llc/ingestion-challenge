"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.initDatabase = initDatabase;
exports.batchInsertEvents = batchInsertEvents;
exports.getEventCount = getEventCount;
exports.getAllEventIds = getAllEventIds;
exports.closePool = closePool;
const pg_1 = require("pg");
const config_1 = require("../config");
let pool = null;
function getAdminConnectionString() {
    // Replace the database name with 'postgres' to connect to the default database
    const url = new URL(config_1.config.databaseUrl);
    url.pathname = '/postgres';
    return url.toString();
}
function getDatabaseName() {
    const url = new URL(config_1.config.databaseUrl);
    return url.pathname.slice(1); // Remove leading '/'
}
async function ensureDatabase() {
    const dbName = getDatabaseName();
    const adminPool = new pg_1.Pool({
        connectionString: getAdminConnectionString(),
    });
    try {
        // Check if database exists
        const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (result.rows.length === 0) {
            // Create database
            console.log(`Creating database '${dbName}'...`);
            await adminPool.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database '${dbName}' created`);
        }
    }
    finally {
        await adminPool.end();
    }
}
async function getPool() {
    if (!pool) {
        pool = new pg_1.Pool({
            connectionString: config_1.config.databaseUrl,
        });
    }
    return pool;
}
async function initDatabase() {
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
async function batchInsertEvents(events) {
    if (events.length === 0)
        return;
    const db = await getPool();
    // Build values for batch insert
    const values = [];
    const placeholders = [];
    events.forEach((event, i) => {
        const offset = i * 9;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
        values.push(event.id, event.sessionId, event.userId, event.type, event.name, JSON.stringify(event.properties), typeof event.timestamp === 'number' ? event.timestamp : Date.parse(event.timestamp), event.session?.deviceType || null, event.session?.browser || null);
    });
    await db.query(`
    INSERT INTO ingested_events (id, session_id, user_id, type, name, properties, timestamp, device_type, browser)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO NOTHING
  `, values);
}
async function getEventCount() {
    const db = await getPool();
    const result = await db.query('SELECT COUNT(*) as count FROM ingested_events');
    return parseInt(result.rows[0].count, 10);
}
async function getAllEventIds() {
    const db = await getPool();
    const result = await db.query('SELECT id FROM ingested_events ORDER BY id');
    return result.rows.map(row => row.id);
}
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
//# sourceMappingURL=client.js.map