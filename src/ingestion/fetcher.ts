import { fetchPage } from '../api/client';
import { batchInsertEvents } from '../db/client';
import { saveCheckpoint, loadCheckpoint } from './checkpoint';
import { AsyncQueue } from './queue';

export interface IngestionStats {
  totalIngested: number;
  totalExpected: number;
  pagesProcessed: number;
  startTime: number;
}

interface ConsumerState {
  totalIngested: number;
  totalExpected: number;
  pagesProcessed: number;
  startTime: number;
}

const BUFFER_SIZE = 5;

async function fetchPages(
  queue: AsyncQueue,
  startCursor: string | null
): Promise<void> {
  let cursor = startCursor;

  while (true) {
    const response = await fetchPage(cursor);
    await queue.enqueue(response);

    if (!response.pagination.hasMore) {
      break;
    }
    cursor = response.pagination.nextCursor;
  }

  queue.close();
}

async function writePages(
  queue: AsyncQueue,
  state: ConsumerState
): Promise<IngestionStats> {
  let { totalIngested, totalExpected, pagesProcessed, startTime } = state;

  while (true) {
    const response = await queue.dequeue();
    if (response === null) {
      break;
    }

    // Update total expected from API response
    totalExpected = response.meta.total;

    // Insert full events
    await batchInsertEvents(response.data);
    totalIngested += response.data.length;
    pagesProcessed++;

    // Save checkpoint
    await saveCheckpoint(response.pagination.nextCursor, totalIngested);

    // Log progress
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = totalIngested / elapsed;
    const remaining = (totalExpected - totalIngested) / rate;
    const percent = ((totalIngested / totalExpected) * 100).toFixed(2);

    console.log(
      `Progress: ${totalIngested.toLocaleString()} / ${totalExpected.toLocaleString()} ` +
      `(${percent}%) | ${rate.toFixed(0)} events/sec | ETA: ${formatTime(remaining)} | Buffer: ${queue.size}`
    );
  }

  console.log('No more pages - ingestion complete!');

  return {
    totalIngested,
    totalExpected,
    pagesProcessed,
    startTime,
  };
}

export async function runIngestion(): Promise<IngestionStats> {
  const startTime = Date.now();

  // Check for existing checkpoint
  const checkpoint = await loadCheckpoint();
  const startCursor = checkpoint?.cursor ?? null;
  const totalIngested = checkpoint?.eventsIngested ?? 0;
  const pagesProcessed = checkpoint ? Math.floor(checkpoint.eventsIngested / 100) : 0;

  if (checkpoint) {
    console.log(`Resuming from checkpoint: ${totalIngested} events already ingested`);
  } else {
    console.log('Starting fresh ingestion');
  }

  const queue = new AsyncQueue(BUFFER_SIZE);

  const initialState: ConsumerState = {
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

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
