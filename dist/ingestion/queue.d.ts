import { ApiResponse } from '../api/types';
export declare class AsyncQueue {
    private buffer;
    private readonly maxSize;
    private closed;
    private enqueueResolvers;
    private dequeueResolvers;
    constructor(maxSize?: number);
    enqueue(item: ApiResponse): Promise<void>;
    dequeue(): Promise<ApiResponse | null>;
    close(): void;
    get size(): number;
    get isClosed(): boolean;
}
//# sourceMappingURL=queue.d.ts.map