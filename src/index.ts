import { config, validateConfig } from './config';
import { initDatabase, closePool, getEventCount } from './db/client';
import { runIngestion } from './ingestion/fetcher';
import { submitAllEvents } from './submission/submit';

async function main() {
  console.log('='.repeat(60));
  console.log('DataSync Ingestion Pipeline');
  console.log('='.repeat(60));

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration error:', (error as Error).message);
    process.exit(1);
  }

  console.log(`API Base URL: ${config.apiBaseUrl}`);
  console.log(`Database URL: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`Page size: ${config.pageSize} events/request`);

  try {
    // Initialize database
    console.log('\nInitializing database...');
    await initDatabase();

    // Check existing progress
    const existingCount = await getEventCount();
    if (existingCount > 0) {
      console.log(`Found ${existingCount.toLocaleString()} existing events in database`);
    }

    // Run ingestion
    console.log('\nStarting ingestion...');
    const stats = await runIngestion();

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
    await submitAllEvents();

    console.log('\nDone!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

main();
