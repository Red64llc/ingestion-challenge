export const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1',
  apiKey: process.env.API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5434/ingestion',

  // Retry settings
  maxRetries: 5,
  retryBaseDelay: 1000,

  // Batch settings
  batchSize: 100,

  // Page size for API requests (max supported by API is 5000)
  pageSize: parseInt(process.env.PAGE_SIZE || '5000', 10),

  // Logging
  logProgress: true,
  progressInterval: 1000, // Log every N events
};

export function validateConfig(): void {
  if (!config.apiKey) {
    throw new Error('API_KEY environment variable is required');
  }
}
