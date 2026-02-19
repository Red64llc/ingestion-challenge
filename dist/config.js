"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
exports.config = {
    apiBaseUrl: process.env.API_BASE_URL || 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1',
    apiKey: process.env.API_KEY || '',
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5434/ingestion',
    // Retry settings
    maxRetries: 3,
    retryBaseDelay: 1000,
    // Batch settings
    batchSize: 100,
    // Logging
    logProgress: true,
    progressInterval: 1000, // Log every N events
};
function validateConfig() {
    if (!exports.config.apiKey) {
        throw new Error('API_KEY environment variable is required');
    }
}
//# sourceMappingURL=config.js.map