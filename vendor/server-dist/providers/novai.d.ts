import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import type { CompletionOptions, KeyValidationResult } from './base.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const NOVAI_BASE_URL = "https://aiapi-pro.com/v1";
/** Chat and video share NovAI's daily free allowance. Rows are delivered only
 * by the signed catalog; registering a key never bypasses the 30-day gate. */
export declare class NovaiProvider extends OpenAICompatProvider {
    constructor();
    get supportsKeyValidation(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=novai.d.ts.map