export interface RerankResult {
    platform: string;
    modelId: string;
    results: {
        index: number;
        relevanceScore: number;
        document: string;
    }[];
}
export declare class RerankError extends Error {
    status: number;
    code?: string;
    retryAfterMs?: number;
    constructor(message: string, status: number, code?: string, retryAfterMs?: number);
}
export declare function runRerank(model: string | undefined, query: string, documents: string[], topN?: number): Promise<RerankResult>;
/** Whole seconds the client should wait before retrying: the upstream back-off
 *  when the chain was rate limited, else the monthly-budget reset. */
export declare function rerankRetryAfterSec(err: RerankError): number | undefined;
//# sourceMappingURL=rerank.d.ts.map