import type { Platform } from '@freellmapi/shared/types.js';
import type { KeyValidationResult } from './base.js';
import { SearchOnlyProvider } from './search-only.js';
export declare const TAVILY_BASE_URL = "https://api.tavily.com";
export declare class TavilyProvider extends SearchOnlyProvider {
    readonly platform: Platform;
    readonly name = "Tavily";
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=tavily.d.ts.map