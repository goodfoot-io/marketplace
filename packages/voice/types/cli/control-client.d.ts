/**
 * HTTP client for talking to the voice control server (port+1).
 */
export interface ControlClientOptions {
    controlPort: number;
}
export declare function getStatus(controlPort: number): Promise<{
    statusCode: number;
    body: string;
}>;
export declare function postJson(controlPort: number, path: string, data: Record<string, unknown>): Promise<{
    statusCode: number;
    body: string;
}>;
export declare function postEmpty(controlPort: number, path: string): Promise<{
    statusCode: number;
    body: string;
}>;
/**
 * GET /watch with query params, returns raw body text (JSONL).
 */
export declare function watchOnce(controlPort: number, events: string[], after: number): Promise<{
    statusCode: number;
    body: string;
}>;
