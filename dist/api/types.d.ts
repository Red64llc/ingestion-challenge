export interface EventProperties {
    page?: string;
    [key: string]: unknown;
}
export interface Session {
    id: string;
    deviceType: string;
    browser: string;
}
export interface Event {
    id: string;
    sessionId: string;
    userId: string;
    type: string;
    name: string;
    properties: EventProperties;
    timestamp: number | string;
    session: Session;
}
export interface Pagination {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorExpiresIn: number;
}
export interface Meta {
    total: number;
    returned: number;
    requestId: string;
}
export interface ApiResponse {
    data: Event[];
    pagination: Pagination;
    meta: Meta;
}
export interface SubmissionResponse {
    success: boolean;
    message?: string;
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map