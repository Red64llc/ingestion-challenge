export interface IngestionStats {
    totalIngested: number;
    totalExpected: number;
    pagesProcessed: number;
    startTime: number;
}
export declare function runIngestion(): Promise<IngestionStats>;
//# sourceMappingURL=fetcher.d.ts.map