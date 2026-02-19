"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPage = fetchPage;
exports.submitIds = submitIds;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function withRetry(fn, maxRetries = config_1.config.maxRetries) {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            const axiosError = error;
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
                const delay = Math.pow(2, i) * config_1.config.retryBaseDelay + Math.random() * 1000;
                console.log(`Request failed. Retrying in ${Math.round(delay)}ms... (attempt ${i + 2}/${maxRetries})`);
                await sleep(delay);
            }
        }
    }
    throw lastError || new Error('Max retries exceeded');
}
async function fetchPage(cursor) {
    return withRetry(async () => {
        const url = cursor
            ? `${config_1.config.apiBaseUrl}/events?cursor=${encodeURIComponent(cursor)}`
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
            timeout: 120000, // 2 minute timeout for submission
        });
        return response.data;
    });
}
//# sourceMappingURL=client.js.map