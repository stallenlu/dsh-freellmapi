export interface NormalizedModel {
    id: string;
    name: string;
    ownedBy: string;
    available: number;
    enabled: number;
    contextWindow: number | null;
    intel: number;
    platforms: string[];
    supportsTools: boolean;
    executionStatus: 'ready' | 'needsKey' | 'exhausted';
}
export interface ModelListing {
    models: NormalizedModel[];
    autoContextWindow: number | null;
}
/**
 * The context window to ADVERTISE for an entry the router can serve from
 * several models (auto, fusion, a named chain, a unify group): the largest
 * window that most of those models hold, i.e. the upper median, not the max.
 * Clients size their context to this number (OpenClaw compacts against it),
 * and advertising the single biggest window meant one 1M model made `auto`
 * claim 1M, so sessions grew until every request carried 500k+ tokens that
 * most of the pool rejects (#1717). Larger requests still route: the router's
 * size gates send them to the models that can hold them.
 */
export declare function servableContextWindow(windows: readonly (number | null | undefined)[]): number | null;
export declare function buildModelListing(): ModelListing;
//# sourceMappingURL=model-listing.d.ts.map