"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCheckpoint = saveCheckpoint;
exports.loadCheckpoint = loadCheckpoint;
exports.clearCheckpoints = clearCheckpoints;
const client_1 = require("../db/client");
async function saveCheckpoint(cursor, eventsIngested) {
    const db = await (0, client_1.getPool)();
    await db.query(`
    INSERT INTO checkpoints (next_cursor, events_ingested)
    VALUES ($1, $2)
  `, [cursor, eventsIngested]);
}
async function loadCheckpoint() {
    const db = await (0, client_1.getPool)();
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
async function clearCheckpoints() {
    const db = await (0, client_1.getPool)();
    await db.query('DELETE FROM checkpoints');
}
//# sourceMappingURL=checkpoint.js.map