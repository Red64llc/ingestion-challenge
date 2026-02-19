"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const client_1 = require("./db/client");
const fetcher_1 = require("./ingestion/fetcher");
const submit_1 = require("./submission/submit");
async function main() {
    console.log('='.repeat(60));
    console.log('DataSync Ingestion Pipeline');
    console.log('='.repeat(60));
    // Validate configuration
    try {
        (0, config_1.validateConfig)();
    }
    catch (error) {
        console.error('Configuration error:', error.message);
        process.exit(1);
    }
    console.log(`API Base URL: ${config_1.config.apiBaseUrl}`);
    console.log(`Database URL: ${config_1.config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
    try {
        // Initialize database
        console.log('\nInitializing database...');
        await (0, client_1.initDatabase)();
        // Check existing progress
        const existingCount = await (0, client_1.getEventCount)();
        if (existingCount > 0) {
            console.log(`Found ${existingCount.toLocaleString()} existing events in database`);
        }
        // Run ingestion
        console.log('\nStarting ingestion...');
        const stats = await (0, fetcher_1.runIngestion)();
        const totalTime = (Date.now() - stats.startTime) / 1000;
        console.log('\n' + '='.repeat(60));
        console.log('ingestion complete');
        console.log(`Total events: ${stats.totalIngested.toLocaleString()}`);
        console.log(`Pages processed: ${stats.pagesProcessed.toLocaleString()}`);
        console.log(`Total time: ${formatTime(totalTime)}`);
        console.log(`Average rate: ${(stats.totalIngested / totalTime).toFixed(0)} events/sec`);
        console.log('='.repeat(60));
        // Submit results
        console.log('\nSubmitting results...');
        await (0, submit_1.submitAllEvents)();
        console.log('\nDone!');
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
    finally {
        await (0, client_1.closePool)();
    }
}
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}
main();
//# sourceMappingURL=index.js.map