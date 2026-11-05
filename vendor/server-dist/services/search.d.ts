import { isSearchPlatform } from '../lib/search-platforms.js';
export declare const SEARCH_MODALITY = "search";
export interface SearchHit {
    title: string;
    url: string;
    content: string;
    score: number;
}
export interface SearchResponse {
    query: string;
    answer?: string;
    results: SearchHit[];
    /** Platform that served the search ('tavily', 'exa', ..., or 'custom'). */
    provider: string;
    /** Engine id that served the search ('tavily-search', ...). */
    engine: string;
}
export declare class SearchError extends Error {
    status: number;
    code?: string;
    retryAfterMs?: number;
    constructor(message: string, status: number, code?: string, retryAfterMs?: number);
}
export interface SearchOptions {
    maxResults?: number;
    topic?: 'general' | 'news';
    includeAnswer?: boolean;
    /** Pin one engine by id; omitted or 'auto' walks the whole chain. */
    engine?: string;
    engineRowId?: number;
    /** Agent the search runs for (e.g. 'claude-code'); defaults to the request's
     *  detected client. Recorded on search_requests. */
    clientAgent?: string | null;
    /** The caller's cancellation (a departed client). */
    signal?: AbortSignal;
}
export interface SearchEngineFeatures {
    news?: boolean;
    answer?: boolean;
    fullContent?: boolean;
}
export interface SearchEngineMeta {
    creditsPerQuery?: number | null;
    features?: SearchEngineFeatures;
    premiumSince?: string | null;
}
export declare function parseSearchMeta(raw: string | null): SearchEngineMeta;
export declare function decodeEntities(v: string): string;
/** Platforms with a search adapter. catalog-sync gates searchEngines rows on
 *  this, the way VIDEO_PLATFORMS gates video rows. */
export declare const SEARCH_ENGINE_PLATFORMS: Set<string>;
/** True when at least one enabled engine has a usable key, i.e. a search can
 *  be attempted. The agents' web_search integration keys off this. */
export declare function searchAvailable(): boolean;
export declare const SEARCH_PLATFORM_INFO: Record<string, {
    name: string;
    keyless?: boolean;
}>;
export type SearchEngineState = 'ready' | 'cooling_down' | 'needs_key' | 'key_error' | 'disabled';
export interface SearchStatus {
    /** ready: a search can run now; cooling_down: keys exist but every one is
     *  benched; needs_configuration: nothing to search with. */
    status: 'ready' | 'cooling_down' | 'needs_configuration';
    /** Every engine in the installed catalog (plus custom relays), in order. */
    engines: Array<{
        engine: string;
        platform: string;
        state: SearchEngineState;
    }>;
    /** Search platforms with a saved key whose engine is not in the installed
     *  catalog yet, so the key cannot search until a catalog update adds it. */
    missing_from_catalog: string[];
}
/** Search readiness from local state only: catalog rows, saved keys and
 *  cooldowns. Runs no search and spends no quota. */
export declare function searchStatus(): SearchStatus;
/** The "nothing to search with" message, built from what is installed: it
 *  names only engines this catalog has, and says why a saved key cannot run. */
export declare function noSearchMessage(s?: SearchStatus): string;
export declare function runSearch(query: string, opts?: SearchOptions): Promise<SearchResponse>;
/** Whole seconds the client should wait before retrying: the upstream back-off
 *  when the chain was rate limited, else the monthly-budget reset. */
export declare function searchRetryAfterSec(err: SearchError): number | undefined;
export interface SearchEngineView {
    id: number;
    platform: string;
    engineId: string;
    displayName: string;
    priority: number;
    enabled: boolean;
    quotaLabel: string;
    creditsPerQuery: number | null;
    features: SearchEngineFeatures;
    premiumSince: string | null;
    /** premiumSince + 30 days: when a free install receives the engine. */
    freeFrom: string | null;
    isCustom: boolean;
    keyCount: number;
    healthyKeyCount: number;
    searchesThisMonth: number;
}
export declare function listSearchEngines(): SearchEngineView[];
/** Turn an engine on/off and/or move it to `priority` (0 = first/default).
 *  A move renumbers every engine 0..n-1 in the new order and stores that as
 *  the local order. Returns false when the id is not a search engine. */
export declare function updateSearchEngine(id: number, patch: {
    enabled?: boolean;
    priority?: number;
}): boolean;
export type SearchAnalyticsRange = '24h' | '7d' | '30d' | '90d' | 'all';
export interface SearchAnalytics {
    total: number;
    today: number;
    successRate: number;
    avgLatencyMs: number;
    byEngine: Array<{
        engineId: string;
        displayName: string;
        count: number;
    }>;
    series: Array<{
        date: string;
        engineId: string;
        count: number;
    }>;
}
/** Searches over a range: totals count successful searches; successRate and
 *  latency are over every attempt (a failed attempt that failed over is
 *  still a cost the operator wants to see). */
export declare function searchAnalytics(range: SearchAnalyticsRange): SearchAnalytics;
/** Search platforms are not chat providers; re-exported for routes that
 *  decorate the provider list. */
export { isSearchPlatform };
//# sourceMappingURL=search.d.ts.map