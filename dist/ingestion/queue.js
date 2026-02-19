"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncQueue = void 0;
class AsyncQueue {
    buffer = [];
    maxSize;
    closed = false;
    enqueueResolvers = [];
    dequeueResolvers = [];
    constructor(maxSize = 5) {
        this.maxSize = maxSize;
    }
    async enqueue(item) {
        if (this.closed) {
            throw new Error('Cannot enqueue to closed queue');
        }
        // If there's a waiting consumer, deliver directly
        if (this.dequeueResolvers.length > 0) {
            const resolve = this.dequeueResolvers.shift();
            resolve(item);
            return;
        }
        // If buffer is full, wait for space
        while (this.buffer.length >= this.maxSize) {
            await new Promise(resolve => {
                this.enqueueResolvers.push(resolve);
            });
        }
        this.buffer.push(item);
    }
    async dequeue() {
        // If there's data in buffer, return it
        if (this.buffer.length > 0) {
            const item = this.buffer.shift();
            // Notify waiting producers that there's space
            if (this.enqueueResolvers.length > 0) {
                const resolve = this.enqueueResolvers.shift();
                resolve();
            }
            return item;
        }
        // If queue is closed and empty, return null
        if (this.closed) {
            return null;
        }
        // Wait for data
        return new Promise(resolve => {
            this.dequeueResolvers.push(resolve);
        });
    }
    close() {
        this.closed = true;
        // Resolve all waiting consumers with null
        while (this.dequeueResolvers.length > 0) {
            const resolve = this.dequeueResolvers.shift();
            resolve(null);
        }
    }
    get size() {
        return this.buffer.length;
    }
    get isClosed() {
        return this.closed;
    }
}
exports.AsyncQueue = AsyncQueue;
//# sourceMappingURL=queue.js.map