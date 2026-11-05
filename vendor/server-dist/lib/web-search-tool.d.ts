import type { Request, Response } from 'express';
/** The function name the routed model sees. Matches both protocols' built-in
 *  tool name, so a model that already knows the convention calls it naturally. */
export declare const WEB_SEARCH_TOOL_NAME = "web_search";
export declare const WEB_SEARCH_FUNCTION_DESCRIPTION: string;
export declare const WEB_SEARCH_FUNCTION_PARAMETERS: {
    readonly type: "object";
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly description: "The search query.";
        };
    };
    readonly required: readonly ["query"];
    readonly additionalProperties: false;
};
/** Default and ceiling for searches per request when the client sets none. */
export declare const DEFAULT_MAX_SEARCHES = 5;
export declare const MAX_SEARCHES_CEILING = 20;
/** True when at least one enabled search engine has a usable key — the same
 *  check /v1/search routes with, so agents' web search only switches on when a
 *  search can actually run. */
export declare function hasSearchCapability(): boolean;
export interface WebSearchHit {
    title: string;
    url: string;
    content: string;
    score: number;
}
export type WebSearchErrorCode = 'too_many_requests' | 'invalid_tool_input' | 'max_uses_exceeded' | 'query_too_long' | 'unavailable';
export type WebSearchOutcome = {
    ok: true;
    query: string;
    results: WebSearchHit[];
    engine?: string;
    provider?: string;
} | {
    ok: false;
    query: string;
    errorCode: WebSearchErrorCode;
    message: string;
};
export interface DomainFilter {
    allowedDomains?: string[];
    blockedDomains?: string[];
}
/** Apply allowed/blocked domain lists (Anthropic `allowed_domains`, Responses
 *  `filters.allowed_domains`). Search providers differ in native support, so
 *  the gateway filters the hits itself. */
export declare function filterHitsByDomain(hits: WebSearchHit[], filter: DomainFilter): WebSearchHit[];
/** Run one search on behalf of an agent. Never throws: failures become the
 *  protocol's in-band error result so the model can carry on without it. */
export declare function performWebSearch(rawQuery: unknown, filter?: DomainFilter): Promise<WebSearchOutcome>;
/** The tool-result text the routed model reads for one search. */
export declare function formatOutcomeForModel(outcome: WebSearchOutcome): string;
export declare function encodeHitContent(hit: WebSearchHit): string;
export declare function decodeHitContent(encrypted: unknown): string;
export declare function newServerToolUseId(): string;
export declare function newWebSearchCallId(): string;
export interface CapturedResponse {
    status: number;
    body: any;
    headers: Record<string, string>;
}
type Handler = (req: Request, res: Response) => Promise<void> | void;
/** Run `handler` with `body` in place of the client's body and capture its
 *  reply. A disconnect of the real client aborts the inner call. */
export declare function invokeHandlerCaptured(handler: Handler, req: Request, outer: Response, body: unknown): Promise<CapturedResponse>;
/** Copy the inner turn's diagnostic headers onto the real response. */
export declare function copyCapturedHeaders(captured: CapturedResponse, res: Response): void;
/** Clamp a client-supplied max_uses. */
export declare function resolveMaxSearches(raw: unknown): number;
export {};
//# sourceMappingURL=web-search-tool.d.ts.map