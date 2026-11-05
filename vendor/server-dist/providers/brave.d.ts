import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const BRAVE_BASE_URL = "https://api.search.brave.com/res/v1";
/** Brave answers a bad key with 422 (not 401) and this error code; a 422 with
 *  any other code (VALIDATION) is a bad parameter and the key is fine. */
export declare const BRAVE_BAD_KEY_CODE = "SUBSCRIPTION_TOKEN_INVALID";
export declare class BraveProvider extends SearchOnlyProvider {
    readonly platform: "brave";
    readonly name = "Brave Search";
    get supportsKeyPolling(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=brave.d.ts.map