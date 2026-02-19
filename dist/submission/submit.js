"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitAllEvents = submitAllEvents;
const client_1 = require("../db/client");
const client_2 = require("../api/client");
async function submitAllEvents() {
    const count = await (0, client_1.getEventCount)();
    console.log(`Preparing to submit ${count.toLocaleString()} event IDs...`);
    if (count === 0) {
        throw new Error('No events to submit!');
    }
    // Get all event IDs
    console.log('Fetching all event IDs from database...');
    const ids = await (0, client_1.getAllEventIds)();
    console.log(`Fetched ${ids.length.toLocaleString()} IDs`);
    // Submit to API
    console.log('Submitting to API...');
    const result = await (0, client_2.submitIds)(ids);
    console.log('Submission result:', JSON.stringify(result, null, 2));
}
//# sourceMappingURL=submit.js.map