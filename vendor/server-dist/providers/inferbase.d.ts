import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { type CompletionOptions, type KeyValidationResult } from './base.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const INFERBASE_BASE_URL = "https://api.inferbase.ai/v1";
/** Free managed chat shares monthly request and daily usage allowances.
 * Model rows remain exclusively in the signed, tier-gated catalog. */
export declare class InferbaseProvider extends OpenAICompatProvider {
    constructor();
    protected validationResult(response: Response): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=inferbase.d.ts.map