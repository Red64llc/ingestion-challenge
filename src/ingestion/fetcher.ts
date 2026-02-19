import { fetchPage, CursorExpiredError } from '../api/client';
import { fetchStreamPage, isStreamAvailable } from '../api/stream';
import { batchInsertEvents, getEventCount } from '../db/client';
import { saveCheckpoint, loadCheckpoint, clearCheckpoints } from './checkpoint';
import { AsyncQueue } from './queue';
import { config } from '../config';

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

const BUFFER_SIZE = 10; // Larger buffer for high-throughput stream

async function fetchPagesStream(
  queue: AsyncQueue,
  startCursor: string | null
): Promise<void> {
  let cursor = startCursor;

  console.log('Using high-throughput stream feed (no rate limits!)');

  while (true) {
    try {
      const response = await fetchStreamPage(cursor, config.pageSize);
      await queue.enqueue(response);

      if (!response.pagination.hasMore) {
        break;
      }
      cursor = response.pagination.nextCursor;
    } catch (error) {
      // If stream fails, don't retry - let it bubble up
      console.error('Stream fetch error:', error);
      throw error;
    }
  }

  queue.close();
}

async function fetchPagesRegular(
  queue: AsyncQueue,
  startCursor: string | null
): Promise<void> {
  let cursor = startCursor;
  let cursorExpiredRetries = 0;
  const MAX_CURSOR_RETRIES = 3;

  console.log('Using regular API (rate limited)');

  while (true) {
    try {
      const response = await fetchPage(cursor, config.pageSize);
      await queue.enqueue(response);

      if (!response.pagination.hasMore) {
        break;
      }
      cursor = response.pagination.nextCursor;
      cursorExpiredRetries = 0;
    } catch (error) {
      if (error instanceof CursorExpiredError) {
        cursorExpiredRetries++;
        if (cursorExpiredRetries > MAX_CURSOR_RETRIES) {
          console.error('Too many cursor expiration errors. Giving up.');
          throw error;
        }
        console.warn(`Cursor expired. Clearing checkpoint and restarting (attempt ${cursorExpiredRetries}/${MAX_CURSOR_RETRIES})...`);
        await clearCheckpoints();
        cursor = null;
        continue;
      }
      throw error;
    }
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

    totalExpected = response.meta.total;

    await batchInsertEvents(response.data);
    totalIngested += response.data.length;
    pagesProcessed++;

    await saveCheckpoint(response.pagination.nextCursor, totalIngested);

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

  const checkpoint = await loadCheckpoint();
  const startCursor = checkpoint?.cursor ?? null;

  const dbEventCount = await getEventCount();
  const totalIngested = Math.max(checkpoint?.eventsIngested ?? 0, dbEventCount);
  const pagesProcessed = checkpoint ? Math.floor(checkpoint.eventsIngested / 100) : 0;

  if (checkpoint && startCursor) {
    console.log(`Resuming from checkpoint: ${totalIngested} events already ingested`);
    console.log(`Database has ${dbEventCount} events`);
  } else if (dbEventCount > 0) {
    console.log(`No valid checkpoint, but database has ${dbEventCount} events`);
    console.log('Starting from beginning - duplicates will be skipped');
  } else {
    console.log('Starting fresh ingestion');
  }

  // Check if high-throughput stream is available
  const useStream = await isStreamAvailable();

  const queue = new AsyncQueue(BUFFER_SIZE);

  // When using stream, always start fresh - it's fast and cursors may be incompatible
  let effectiveCursor = startCursor;
  let effectiveIngested = totalIngested;

  if (useStream && startCursor) {
    console.log('Stream mode: ignoring checkpoint cursor, starting fresh (existing events will be skipped via ON CONFLICT)');
    effectiveCursor = null;
    // Keep totalIngested for accurate progress display, DB will skip duplicates
  }

  const initialState: ConsumerState = {
    totalIngested: effectiveIngested,
    totalExpected: 3000000,
    pagesProcessed,
    startTime,
  };

  // Use stream if available, otherwise fall back to regular API
  const fetchFunction = useStream ? fetchPagesStream : fetchPagesRegular;

  const [, stats] = await Promise.all([
    fetchFunction(queue, effectiveCursor),
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
