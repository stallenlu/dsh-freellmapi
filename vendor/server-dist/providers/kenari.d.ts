import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { type CompletionOptions, type KeyValidationResult, type ProviderFetchOptions } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
export declare const KENARI_BASE_URL = "https://kenari.id/v1";
export declare function requireKenariFreeModel(modelId: string): void;
/** Named :free routes share the account's renewable daily quota. Never strip
 * the suffix, discover the paid roster, or retry a paid route. Model rows are
 * delivered only by the signed catalog. Docs: https://kenari.id/en/docs. */
export declare class KenariProvider extends OpenAICompatProvider {
    constructor();
    protected fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number, options?: ProviderFetchOptions): Promise<Response>;
    protected validationResult(response: Response): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=kenari.d.ts.map