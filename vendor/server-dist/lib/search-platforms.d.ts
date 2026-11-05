import type { SearchPlatform } from '@freellmapi/shared/types.js';
export declare const SEARCH_PLATFORMS: readonly SearchPlatform[];
/** True for platforms whose keys serve web search only, never chat. */
export declare function isSearchPlatform(platform: string): platform is SearchPlatform;
//# sourceMappingURL=search-platforms.d.ts.map