import { ApiResponse } from './types';
export declare class CursorExpiredError extends Error {
    constructor(message?: string);
}
export declare function fetchPage(cursor?: string | null, limit?: number): Promise<ApiResponse>;
export declare function submitIds(ids: string[]): Promise<unknown>;
//# sourceMappingURL=client.d.ts.map