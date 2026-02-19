import { ApiResponse } from '../api/types';

export class AsyncQueue {
  private buffer: ApiResponse[] = [];
  private readonly maxSize: number;
  private closed = false;

  private enqueueResolvers: Array<() => void> = [];
  private dequeueResolvers: Array<(value: ApiResponse | null) => void> = [];

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
  }

  async enqueue(item: ApiResponse): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot enqueue to closed queue');
    }

    // If there's a waiting consumer, deliver directly
    if (this.dequeueResolvers.length > 0) {
      const resolve = this.dequeueResolvers.shift()!;
      resolve(item);
      return;
    }

    // If buffer is full, wait for space
    while (this.buffer.length >= this.maxSize) {
      await new Promise<void>(resolve => {
        this.enqueueResolvers.push(resolve);
      });
    }

    this.buffer.push(item);
  }

  async dequeue(): Promise<ApiResponse | null> {
    // If there's data in buffer, return it
    if (this.buffer.length > 0) {
      const item = this.buffer.shift()!;
      // Notify waiting producers that there's space
      if (this.enqueueResolvers.length > 0) {
        const resolve = this.enqueueResolvers.shift()!;
        resolve();
      }
      return item;
    }

    // If queue is closed and empty, return null
    if (this.closed) {
      return null;
    }

    // Wait for data
    return new Promise<ApiResponse | null>(resolve => {
      this.dequeueResolvers.push(resolve);
    });
  }

  close(): void {
    this.closed = true;
    // Resolve all waiting consumers with null
    while (this.dequeueResolvers.length > 0) {
      const resolve = this.dequeueResolvers.shift()!;
      resolve(null);
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
