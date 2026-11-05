import type { ChatCompletionChunk, ChatCompletionResponse } from '@freellmapi/shared/types.js';
import { BaseProvider, type KeyValidationResult } from './base.js';
export declare const FREEAI_BASE_URL = "https://api.free.ai";
/** Only download the output shape exercised live, not arbitrary upstream URLs. */
export declare function freeAiAudioUrl(body: unknown): string | null;
/** Speech/transcription only until the mismatched chat aliases are resolved. Free accounts share
 * 30K tokens/day and 1K API requests/month (no card; verified 2026-10-11).
 * https://free.ai/api/ — model rows belong only in the signed catalog. */
export declare class FreeAiProvider extends BaseProvider {
    readonly platform: "freeai";
    readonly name = "Free.ai";
    get supportsKeyValidation(): boolean;
    validateKey(apiKey: string): Promise<KeyValidationResult>;
    chatCompletion(): Promise<ChatCompletionResponse>;
    streamChatCompletion(): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=freeai.d.ts.map