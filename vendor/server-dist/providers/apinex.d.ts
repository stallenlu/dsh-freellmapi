import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { type CompletionOptions, type KeyValidationResult } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
export declare const APINEX_BASE_URL = "https://api.apinex.bond/v1";
/** Free-category chat shares a weighted daily allowance with decisions.
 * Preserve free/ exactly; never retry a paid alias. Eligibility and model
 * rows belong exclusively in the signed, tier-selected catalog. */
export declare class ApinexProvider extends OpenAICompatProvider {
    constructor();
    protected validationResult(response: Response): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=apinex.d.ts.map