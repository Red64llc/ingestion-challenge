"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIngestion = runIngestion;
const client_1 = require("../api/client");
const client_2 = require("../db/client");
const checkpoint_1 = require("./checkpoint");
const queue_1 = require("./queue");
const config_1 = require("../config");
const BUFFER_SIZE = 5;
async function fetchPages(queue, startCursor) {
    let cursor = startCursor;
    let cursorExpiredRetries = 0;
    const MAX_CURSOR_RETRIES = 3;
    while (true) {
        try {
            const response = await (0, client_1.fetchPage)(cursor, config_1.config.pageSize);
            await queue.enqueue(response);
            if (!response.pagination.hasMore) {
                break;
            }
            cursor = response.pagination.nextCursor;
            cursorExpiredRetries = 0; // Reset on success
        }
        catch (error) {
            if (error instanceof client_1.CursorExpiredError) {
                cursorExpiredRetries++;
                if (cursorExpiredRetries > MAX_CURSOR_RETRIES) {
                    console.error('Too many cursor expiration errors. Giving up.');
                    throw error;
                }
                console.warn(`Cursor expired. Clearing checkpoint and restarting from beginning (attempt ${cursorExpiredRetries}/${MAX_CURSOR_RETRIES})...`);
                console.warn('Note: Existing events will be skipped due to ON CONFLICT DO NOTHING');
                await (0, checkpoint_1.clearCheckpoints)();
                cursor = null; // Restart from beginning
                continue;
            }
            throw error;
        }
    }
    queue.close();
}
async function writePages(queue, state) {
    let { totalIngested, totalExpected, pagesProcessed, startTime } = state;
    while (true) {
        const response = await queue.dequeue();
        if (response === null) {
            break;
        }
        // Update total expected from API response
        totalExpected = response.meta.total;
        // Insert full events
        await (0, client_2.batchInsertEvents)(response.data);
        totalIngested += response.data.length;
        pagesProcessed++;
        // Save checkpoint
        await (0, checkpoint_1.saveCheckpoint)(response.pagination.nextCursor, totalIngested);
        // Log progress
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = totalIngested / elapsed;
        const remaining = (totalExpected - totalIngested) / rate;
        const percent = ((totalIngested / totalExpected) * 100).toFixed(2);
        console.log(`Progress: ${totalIngested.toLocaleString()} / ${totalExpected.toLocaleString()} ` +
            `(${percent}%) | ${rate.toFixed(0)} events/sec | ETA: ${formatTime(remaining)} | Buffer: ${queue.size}`);
    }
    console.log('No more pages - ingestion complete!');
    return {
        totalIngested,
        totalExpected,
        pagesProcessed,
        startTime,
    };
}
async function runIngestion() {
    const startTime = Date.now();
    // Check for existing checkpoint
    const checkpoint = await (0, checkpoint_1.loadCheckpoint)();
    const startCursor = checkpoint?.cursor ?? null;
    // Get actual count from database (more reliable than checkpoint after restarts)
    const dbEventCount = await (0, client_2.getEventCount)();
    const totalIngested = Math.max(checkpoint?.eventsIngested ?? 0, dbEventCount);
    const pagesProcessed = checkpoint ? Math.floor(checkpoint.eventsIngested / 100) : 0;
    if (checkpoint && startCursor) {
        console.log(`Resuming from checkpoint: ${totalIngested} events already ingested`);
        console.log(`Database has ${dbEventCount} events`);
    }
    else if (dbEventCount > 0) {
        console.log(`No valid checkpoint, but database has ${dbEventCount} events`);
        console.log('Starting from beginning - duplicates will be skipped');
    }
    else {
        console.log('Starting fresh ingestion');
    }
    const queue = new queue_1.AsyncQueue(BUFFER_SIZE);
    const initialState = {
        totalIngested,
        totalExpected: 3000000,
        pagesProcessed,
        startTime,
    };
    // Run producer and consumer concurrently
    const [, stats] = await Promise.all([
        fetchPages(queue, startCursor),
        writePages(queue, initialState),
    ]);
    return stats;
}
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0)
        return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
//# sourceMappingURL=fetcher.js.map