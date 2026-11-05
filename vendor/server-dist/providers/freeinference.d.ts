import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import type { CompletionOptions, KeyValidationResult, ProviderFetchOptions } from './base.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const FREEINFERENCE_BASE_URL = "https://freeinference.org/v1";
/** Research service: prompts/responses are logged. Account access varies and
 * chat/embeddings share a daily quota, reset at 00:00 UTC. No model seeds:
 * only the signed catalog may deliver rows through the existing tier gate.
 * Docs: https://doc.freeinference.org/models and /agents */
export declare class FreeInferenceProvider extends OpenAICompatProvider {
    constructor();
    get supportsKeyValidation(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
    protected fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number, fetchOpts?: ProviderFetchOptions): Promise<Response>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=freeinference.d.ts.map