import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { BaseProvider, type KeyValidationResult } from './base.js';
/** Explicitly activated with the normal no-key credential. Decision-only
 * providers must never silently accept a chat completion or send a secret. */
export declare class KeylessDecisionProvider extends BaseProvider {
    readonly platform: 'halx' | 'aisense';
    readonly name: string;
    keyless: boolean;
    constructor(platform: 'halx' | 'aisense', name: string);
    validateKey(): Promise<KeyValidationResult>;
    chatCompletion(_key: string, _messages: ChatMessage[], _model: string): Promise<ChatCompletionResponse>;
    streamChatCompletion(_key: string, _messages: ChatMessage[], _model: string): AsyncGenerator<ChatCompletionChunk>;
}
//# sourceMappingURL=decision-only.d.ts.map