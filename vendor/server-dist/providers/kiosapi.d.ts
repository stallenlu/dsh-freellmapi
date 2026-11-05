import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import type { CompletionOptions, KeyValidationResult, ProviderFetchOptions } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
export declare const KIOSAPI_BASE_URL = "https://api.kiosapi.id/v1";
/** https://kiosapi.id/docs — 50 shared free requests/day without a top-up.
 * Catalog-only: no bundled rows or automatic discovery that bypasses tiers. */
export declare class KiosAPIProvider extends OpenAICompatProvider {
    constructor();
    get supportsKeyValidation(): boolean;
    validateKey(_apiKey: string): Promise<KeyValidationResult>;
    protected fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number, options?: ProviderFetchOptions): Promise<Response>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=kiosapi.d.ts.map