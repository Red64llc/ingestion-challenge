import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { ApiResponse } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class CursorExpiredError extends Error {
  constructor(message: string = 'Cursor has expired') {
    super(message);
    this.name = 'CursorExpiredError';
  }
}

// Token bucket rate limiter - proactively limits requests
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerWindow: number, windowMs: number) {
    this.maxTokens = requestsPerWindow;
    this.tokens = requestsPerWindow;
    this.refillRate = requestsPerWindow / windowMs;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for a token to become available
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitTime);
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Rate limiter: 10 requests per 45 seconds (from X-RateLimit headers)
const rateLimiter = new RateLimiter(10, 45000);

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = config.maxRetries
): Promise<T> {
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data as {
        error?: string;
        message?: string;
        code?: string;
        retryAfter?: number;
        rateLimit?: { limit?: number; remaining?: number; reset?: number; retryAfter?: number };
      } | undefined;

      // Log error details for debugging
      if (axiosError.response) {
        console.error(`API Error: ${status} - ${JSON.stringify(responseData)}`);
      } else if (axiosError.code) {
        console.error(`Network Error: ${axiosError.code} - ${axiosError.message}`);
      }

      // Handle rate limiting - DON'T count against retries
      if (status === 429) {
        let waitTime = 5000;

        // Try to get retryAfter from response body first
        const retryAfterBody = responseData?.retryAfter ?? responseData?.rateLimit?.retryAfter;
        if (typeof retryAfterBody === 'number') {
          waitTime = retryAfterBody * 1000;
        } else {
          // Fallback to header
          const retryAfterHeader = axiosError.response?.headers['retry-after'];
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10);
            waitTime = isNaN(parsed) ? 5000 : parsed * 1000;
          }
        }

        // Add some jitter to avoid thundering herd
        waitTime += Math.random() * 500;
        console.log(`Rate limited. Waiting ${Math.round(waitTime)}ms (not counting as retry)...`);
        await sleep(waitTime);
        continue; // Don't increment retryCount
      }

      // Handle cursor expiration (400 Bad Request with cursor error)
      if (status === 400) {
        const errorMessage = String(responseData?.message || responseData?.error || '').toLowerCase();
        if (errorMessage.includes('cursor') || errorMessage.includes('expired') || errorMessage.includes('invalid')) {
          throw new CursorExpiredError(`Cursor expired or invalid: ${errorMessage}`);
        }
      }

      // Don't retry on other 4xx errors (client errors)
      if (status && status >= 400 && status < 500) {
        throw error;
      }

      // Retry on 5xx errors and network errors
      retryCount++;
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount - 1) * config.retryBaseDelay + Math.random() * 1000;
        console.log(`Request failed (${axiosError.code || status}). Retrying in ${Math.round(delay)}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function fetchPage(cursor?: string | null, limit?: number): Promise<ApiResponse> {
  // Proactively wait for rate limit
  await rateLimiter.acquire();

  return withRetry(async () => {
    const params = new URLSearchParams();
    if (cursor) {
      params.set('cursor', cursor);
    }
    if (limit) {
      params.set('limit', String(limit));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${config.apiBaseUrl}/events?${queryString}`
      : `${config.apiBaseUrl}/events`;

    const response = await axios.get<ApiResponse>(url, {
      headers: { 'X-API-Key': config.apiKey },
      timeout: 60000, // 60s for larger page sizes (up to 5000 events)
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
      timeout: 120000,
    });

    return response.data;
  });
}
