import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const LINKUP_BASE_URL = "https://api.linkup.so/v1";
export declare class LinkupProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Linkup";
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=linkup.d.ts.map