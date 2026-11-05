import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const EXA_BASE_URL = "https://api.exa.ai";
export declare class ExaProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Exa";
    /** #1599: validation is an empty search, so the health pass checks a key
     * once instead of every few minutes. */
    get supportsKeyPolling(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=exa.d.ts.map