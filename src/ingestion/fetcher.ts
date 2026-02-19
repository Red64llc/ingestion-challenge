import { fetchPage } from '../api/client';
import { batchInsertEvents } from '../db/client';
import { saveCheckpoint, loadCheckpoint } from './checkpoint';

export interface IngestionStats {
  totalIngested: number;
  totalExpected: number;
  pagesProcessed: number;
  startTime: number;
}

export async function runIngestion(): Promise<IngestionStats> {
  const startTime = Date.now();

  // Check for existing checkpoint
  const checkpoint = await loadCheckpoint();
  let cursor: string | null = checkpoint?.cursor ?? null;
  let totalIngested = checkpoint?.eventsIngested ?? 0;
  let pagesProcessed = checkpoint ? Math.floor(checkpoint.eventsIngested / 100) : 0;
  let totalExpected = 3000000;

  if (checkpoint) {
    console.log(`Resuming from checkpoint: ${totalIngested} events already ingested`);
  } else {
    console.log('Starting fresh ingestion');
  }

  while (true) {
    const response = await fetchPage(cursor);

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
      `(${percent}%) | ${rate.toFixed(0)} events/sec | ETA: ${formatTime(remaining)}`
    );

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

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
