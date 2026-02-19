"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.initDatabase = initDatabase;
exports.batchInsertIds = batchInsertIds;
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
async function batchInsertIds(ids) {
    if (ids.length === 0)
        return;
    const db = await getPool();
    await db.query(`
    INSERT INTO ingested_events (id)
    SELECT UNNEST($1::varchar[])
    ON CONFLICT DO NOTHING
  `, [ids]);
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