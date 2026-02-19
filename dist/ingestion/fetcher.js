"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIngestion = runIngestion;
const client_1 = require("../api/client");
const client_2 = require("../db/client");
const checkpoint_1 = require("./checkpoint");
async function runIngestion() {
    const startTime = Date.now();
    // Check for existing checkpoint
    const checkpoint = await (0, checkpoint_1.loadCheckpoint)();
    let cursor = checkpoint?.cursor ?? null;
    let totalIngested = checkpoint?.eventsIngested ?? 0;
    let pagesProcessed = checkpoint ? Math.floor(checkpoint.eventsIngested / 100) : 0;
    let totalExpected = 3000000;
    if (checkpoint) {
        console.log(`Resuming from checkpoint: ${totalIngested} events already ingested`);
    }
    else {
        console.log('Starting fresh ingestion');
    }
    while (true) {
        const response = await (0, client_1.fetchPage)(cursor);
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
            `(${percent}%) | ${rate.toFixed(0)} events/sec | ETA: ${formatTime(remaining)}`);
        // Check if we're done
        if (!response.pagination.hasMore) {
            console.log('No more pages - ingestion complete!');
            break;
        }
        cursor = response.pagination.nextCursor;
    }
    return {
        totalIngested,
        totalExpected,
        pagesProcessed,
        startTime,
    };
}
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0)
        return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
//# sourceMappingURL=fetcher.js.map