import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
export declare class FirecrawlProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Firecrawl";
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=firecrawl.d.ts.map