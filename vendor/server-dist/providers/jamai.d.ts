import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage, Platform } from '@freellmapi/shared/types.js';
import { BaseProvider, type CompletionOptions, type KeyValidationResult } from './base.js';
import { type QuotaObservationContext } from '../services/provider-quota.js';
export declare const JAMAI_BASE_URL = "https://api.jamaibase.com/api/v1";
/** The UI collects two fields; the existing encrypted credential stores both.
 * Export/import format: JAMAI_KEY=proj_…:jamai_pat_… . Never put either in a URL.
 * Model rows live only in the signed catalog, not application seeds. */
export declare function jamaiHeaders(credential: string): Record<string, string>;
export declare class JamaiProvider extends BaseProvider {
    readonly platform: Platform;
    readonly name = "JamAI Base";
    private body;
    private record;
    validateKey(credential: string, quotaContext?: QuotaObservationContext): Promise<KeyValidationResult>;
    private request;
    chatCompletion(credential: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(credential: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=jamai.d.ts.map