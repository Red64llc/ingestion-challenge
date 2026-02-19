import { Pool } from 'pg';
export declare function getPool(): Promise<Pool>;
export declare function initDatabase(): Promise<void>;
export declare function batchInsertIds(ids: string[]): Promise<void>;
export declare function getEventCount(): Promise<number>;
export declare function getAllEventIds(): Promise<string[]>;
export declare function closePool(): Promise<void>;
//# sourceMappingURL=client.d.ts.map