import type { Request, Response } from 'express';
/** `web_search_20250305`, `web_search_20260209`, `web_search_20260318`, … */
export declare function isWebSearchServerTool(tool: unknown): boolean;
type Block = Record<string, any>;
/** Earlier search blocks a client replays → text the routed model can read.
 *  Used by the request converter for both our own and real Anthropic blocks. */
export declare function serverToolUseToText(block: Block): string;
export declare function webSearchResultToText(block: Block): string;
/**
 * Serve a /v1/messages request that carries a web_search server tool from the
 * search pool. Returns false (nothing sent) when the request has no such tool
 * or no search key is configured — the caller then runs the normal handler.
 */
export declare function maybeServeAnthropicWebSearch(handler: (req: Request, res: Response) => Promise<void>, req: Request, res: Response): Promise<boolean>;
export {};
//# sourceMappingURL=anthropic-web-search.d.ts.map