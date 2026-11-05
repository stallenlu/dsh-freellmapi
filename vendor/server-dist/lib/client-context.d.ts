import type { NextFunction, Request, Response } from 'express';
import { type ClientAgent } from './client-classifier.js';
import type { PresetStrategy } from '../services/scoring.js';
export interface ClientContext {
    ip: string | null;
    userAgent: string | null;
    agent: ClientAgent | null;
    /** The preset a decision model picked for this request (#1354), read by the
     *  router while the 'decision' strategy is active. Unset = Balanced. */
    routingStrategy?: PresetStrategy;
}
export declare function clientContextMiddleware(req: Request, _res: Response, next: NextFunction): void;
export declare function getClientContext(): ClientContext;
/** Record this request's decision-picked preset (#1354). A no-op outside a
 *  request scope (tests, background work), which then routes as Balanced. */
export declare function setRequestRoutingStrategy(strategy: PresetStrategy | undefined): void;
//# sourceMappingURL=client-context.d.ts.map