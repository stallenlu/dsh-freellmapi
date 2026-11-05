import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { type CompletionOptions, type KeyValidationResult } from './base.js';
import type { QuotaObservationContext } from '../services/provider-quota.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const ONOMEO_BASE_URL = "https://onomeo.com/v1";
export declare function stripOnomeoSignature(text: string): string;
/**
 * onomeo (#1460): an OpenAI-compatible gateway whose free models share one
 * call-counted allowance — 30 calls per 5-hour window per account, with a
 * site-wide pool and a `too_fast` per-minute guard on top. Model rows are
 * published only through the signed catalog; nothing here enrolls models.
 *
 * Error vocabulary (from https://onomeo.com/integrations):
 * - 401 `bad_key` — the only authentication verdict; invalid.
 * - 403 `account_quota` / `network_quota` and 429 `site_busy` / `too_fast` —
 *   quota and throttle answers on a VALID key. Treating 403 as an invalid key
 *   (the base `validationResult` rule) would auto-disable a good key the first
 *   time its 5-hour calls run out, so those statuses stay inconclusive here.
 */
export declare class OnomeoProvider extends OpenAICompatProvider {
    constructor();
    protected validationResult(response: Response): Promise<KeyValidationResult>;
    chatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): Promise<ChatCompletionResponse>;
    streamChatCompletion(apiKey: string, messages: ChatMessage[], modelId: string, options?: CompletionOptions, quotaContext?: QuotaObservationContext): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=onomeo.d.ts.map