import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const PARALLEL_BASE_URL = "https://api.parallel.ai/v1";
export declare const PARALLEL_MCP_URL = "https://search.parallel.ai/mcp";
export declare class ParallelProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Parallel";
    keyless: boolean;
    /** #1599: validation is an empty search, so the health pass checks a key
     * once instead of every few minutes. */
    get supportsKeyPolling(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=parallel.d.ts.map