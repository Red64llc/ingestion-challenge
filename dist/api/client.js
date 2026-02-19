"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorExpiredError = void 0;
exports.fetchPage = fetchPage;
exports.submitIds = submitIds;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
class CursorExpiredError extends Error {
    constructor(message = 'Cursor has expired') {
        super(message);
        this.name = 'CursorExpiredError';
    }
}
exports.CursorExpiredError = CursorExpiredError;
// Token bucket rate limiter - proactively limits requests
class RateLimiter {
    tokens;
    lastRefill;
    maxTokens;
    refillRate; // tokens per ms
    constructor(requestsPerWindow, windowMs) {
        this.maxTokens = requestsPerWindow;
        this.tokens = requestsPerWindow;
        this.refillRate = requestsPerWindow / windowMs;
        this.lastRefill = Date.now();
    }
    async acquire() {
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
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}
// Rate limiter: 10 requests per 2 seconds, but be conservative (8 per 2s)
const rateLimiter = new RateLimiter(8, 2000);
async function withRetry(fn, maxRetries = config_1.config.maxRetries) {
    let lastError = null;
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            const axiosError = error;
            const status = axiosError.response?.status;
            const responseData = axiosError.response?.data;
            // Log error details for debugging
            if (axiosError.response) {
                console.error(`API Error: ${status} - ${JSON.stringify(responseData)}`);
            }
            else if (axiosError.code) {
                console.error(`Network Error: ${axiosError.code} - ${axiosError.message}`);
            }
            // Handle rate limiting - DON'T count against retries
            if (status === 429) {
                let waitTime = 5000;
                // Try to get retryAfter from response body first
                const retryAfterBody = responseData?.retryAfter ?? responseData?.rateLimit?.retryAfter;
                if (typeof retryAfterBody === 'number') {
                    waitTime = retryAfterBody * 1000;
                }
                else {
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
                const delay = Math.pow(2, retryCount - 1) * config_1.config.retryBaseDelay + Math.random() * 1000;
                console.log(`Request failed (${axiosError.code || status}). Retrying in ${Math.round(delay)}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await sleep(delay);
            }
        }
    }
    throw lastError || new Error('Max retries exceeded');
}
async function fetchPage(cursor, limit) {
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
            ? `${config_1.config.apiBaseUrl}/events?${queryString}`
            : `${config_1.config.apiBaseUrl}/events`;
        const response = await axios_1.default.get(url, {
            headers: { 'X-API-Key': config_1.config.apiKey },
            timeout: 30000,
        });
        return response.data;
    });
}
async function submitIds(ids) {
    return withRetry(async () => {
        const body = ids.join('\n');
        const response = await axios_1.default.post(`${config_1.config.apiBaseUrl}/submissions`, body, {
            headers: {
                'X-API-Key': config_1.config.apiKey,
                'Content-Type': 'text/plain',
            },
            timeout: 120000,
        });
        return response.data;
    });
}
//# sourceMappingURL=client.js.map