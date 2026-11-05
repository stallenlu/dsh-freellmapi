import type { Request, Response } from 'express';
import type { ReasoningEffort } from '../lib/sampling-params.js';
export declare const anthropicRouter: import("express-serve-static-core").Router;
export declare function effortFromAnthropicThinking(thinking: {
    type?: string;
    budget_tokens?: number;
} | null | undefined): ReasoningEffort | undefined;
export declare function handleMessages(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=anthropic.d.ts.map