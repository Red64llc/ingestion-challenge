import { getAllEventIds, getEventCount } from '../db/client';
import { submitIds } from '../api/client';

export async function submitAllEvents(): Promise<void> {
  const count = await getEventCount();
  console.log(`Preparing to submit ${count.toLocaleString()} event IDs...`);

  if (count === 0) {
    throw new Error('No events to submit!');
  }

  // Get all event IDs
  console.log('Fetching all event IDs from database...');
  const ids = await getAllEventIds();
  console.log(`Fetched ${ids.length.toLocaleString()} IDs`);

  // Submit to API
  console.log('Submitting to API...');
  const result = await submitIds(ids);

  console.log('Submission result:', JSON.stringify(result, null, 2));
}
