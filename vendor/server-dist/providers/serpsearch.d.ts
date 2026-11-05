import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const SERPSEARCH_BASE_URL = "https://api.serpsearch.com/api/v1";
export declare class SerpSearchProvider extends SearchOnlyProvider {
    readonly platform: "serpsearch";
    readonly name = "SerpSearch";
    /** #1599: SerpSearch has no account or usage endpoint, so the only possible
     * key check is a search with no query, and its maintainer asked that we send
     * none at all (empty searches flag accounts as bots). No health pass, cooldown
     * probe or "Check now" validates a SerpSearch key: it stays 'unknown' until a
     * real search succeeds (markKeyHealthyFromRequest), and a 401/403 on a real
     * search benches it like any other search key. */
    get supportsKeyValidation(): boolean;
    get supportsKeyPolling(): boolean;
    validateKey(): Promise<KeyValidationResult>;
}
//# sourceMappingURL=serpsearch.d.ts.map