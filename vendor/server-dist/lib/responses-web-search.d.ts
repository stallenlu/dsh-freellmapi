import type { Request, Response } from 'express';
/** `web_search`, `web_search_preview`, and their dated variants. */
export declare function isResponsesWebSearchTool(tool: unknown): boolean;
type Item = Record<string, any>;
/** A replayed web_search_call item → a note the routed model can read. */
export declare function webSearchCallToText(item: Item): string;
/**
 * Serve a /v1/responses request that carries a `web_search` tool from the
 * search pool. Returns false (nothing sent) when the request has no such
 * tool, is a Fusion request, or no search key exists — the caller then runs
 * the normal handler, which drops the tool exactly as before.
 */
export declare function maybeServeResponsesWebSearch(handler: (req: Request, res: Response) => Promise<void>, req: Request, res: Response): Promise<boolean>;
export {};
//# sourceMappingURL=responses-web-search.d.ts.map