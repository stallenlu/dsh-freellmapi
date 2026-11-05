import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const KEENABLE_BASE_URL = "https://api.keenable.ai/v1";
/** Keenable identifies keyless callers by app name and refuses a keyless call
 *  without it (400). */
export declare const KEENABLE_APP_TITLE = "freellmapi";
export declare class KeenableProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Keenable";
    keyless: boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=keenable.d.ts.map