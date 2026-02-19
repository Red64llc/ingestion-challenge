export interface Checkpoint {
    cursor: string | null;
    eventsIngested: number;
}
export declare function saveCheckpoint(cursor: string | null, eventsIngested: number): Promise<void>;
export declare function loadCheckpoint(): Promise<Checkpoint | null>;
export declare function clearCheckpoints(): Promise<void>;
//# sourceMappingURL=checkpoint.d.ts.map