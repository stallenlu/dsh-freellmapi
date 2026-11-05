import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { type CompletionOptions, type KeyValidationResult } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
export declare const NABH_BASE_URL = "https://api.nabh.cloud/v1";
/** OpenAI-compatible chat. Only catalog-approved free-plan routes are seeded
 * remotely; /models also lists paid-plan models and is NOT a free-model list.
 * The monthly credits and rate limits are account-wide. X-Balance-INR is an
 * INR wallet balance (including paid top-ups), not a USD or token allowance.
 * Docs: https://nabh.cloud/docs/quickstart/ */
export declare class NabhProvider extends OpenAICompatProvider {
    constructor();
    validateKey(apiKey: string, quotaContext?: QuotaObservationContext): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=nabh.d.ts.map