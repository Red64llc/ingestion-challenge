import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { ApiResponse } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = config.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;

      // Handle rate limiting
      if (axiosError.response?.status === 429) {
        const retryAfter = axiosError.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue;
      }

      // Don't retry on 4xx errors (except 429)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }

      // Exponential backoff for other errors
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * config.retryBaseDelay + Math.random() * 1000;
        console.log(`Request failed. Retrying in ${Math.round(delay)}ms... (attempt ${i + 2}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function fetchPage(cursor?: string | null): Promise<ApiResponse> {
  return withRetry(async () => {
    const url = cursor
      ? `${config.apiBaseUrl}/events?cursor=${encodeURIComponent(cursor)}`
      : `${config.apiBaseUrl}/events`;

    const response = await axios.get<ApiResponse>(url, {
      headers: { 'X-API-Key': config.apiKey },
      timeout: 30000,
    });

    return response.data;
  });
}

export async function submitIds(ids: string[]): Promise<unknown> {
  return withRetry(async () => {
    const body = ids.join('\n');

    const response = await axios.post(`${config.apiBaseUrl}/submissions`, body, {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'text/plain',
      },
      timeout: 120000, // 2 minute timeout for submission
    });

    return response.data;
  });
}
