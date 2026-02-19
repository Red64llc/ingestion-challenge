import axios from 'axios';
import { config } from '../config';
import { ApiResponse } from './types';

interface StreamAccess {
  endpoint: string;
  token: string;
  expiresIn: number;
  tokenHeader: string;
}

interface StreamAccessResponse {
  streamAccess: StreamAccess;
  meta: {
    generatedAt: string;
    note: string;
  };
}

let cachedStreamAccess: StreamAccess | null = null;
let streamAccessExpiry: number = 0;

/**
 * Get stream access token for high-throughput feed
 * Requires dashboard-like headers to authenticate
 */
export async function getStreamAccess(): Promise<StreamAccess> {
  // Return cached token if still valid (with 30s buffer)
  if (cachedStreamAccess && Date.now() < streamAccessExpiry - 30000) {
    return cachedStreamAccess;
  }

  const response = await axios.post<StreamAccessResponse>(
    `${config.apiBaseUrl.replace('/api/v1', '')}/internal/dashboard/stream-access`,
    {},
    {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
        'Cookie': `dashboard_api_key=${config.apiKey}`,
        'Origin': config.apiBaseUrl.replace('/api/v1', ''),
        'Referer': `${config.apiBaseUrl.replace('/api/v1', '')}/`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    }
  );

  cachedStreamAccess = response.data.streamAccess;
  streamAccessExpiry = Date.now() + (response.data.streamAccess.expiresIn * 1000);

  console.log(`Stream access obtained, expires in ${response.data.streamAccess.expiresIn}s`);
  return cachedStreamAccess;
}

/**
 * Fetch page from high-throughput stream feed
 * This endpoint likely has no rate limits!
 */
export async function fetchStreamPage(cursor?: string | null, limit: number = 5000): Promise<ApiResponse> {
  const streamAccess = await getStreamAccess();

  const baseUrl = config.apiBaseUrl.replace('/api/v1', '');
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  params.set('limit', String(limit));

  const url = `${baseUrl}${streamAccess.endpoint}?${params.toString()}`;

  try {
    const response = await axios.get<ApiResponse>(url, {
      headers: {
        'X-API-Key': config.apiKey,
        'X-Stream-Token': streamAccess.token,
      },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Stream feed error:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Check if stream access is available
 */
export async function isStreamAvailable(): Promise<boolean> {
  try {
    await getStreamAccess();
    return true;
  } catch (error) {
    console.warn('Stream access not available, falling back to regular API');
    return false;
  }
}
