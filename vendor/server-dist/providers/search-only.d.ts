import type { ChatCompletionChunk, ChatCompletionResponse, ChatMessage } from '@freellmapi/shared/types.js';
import { BaseProvider, type CompletionOptions, type KeyValidationResult } from './base.js';
export declare abstract class SearchOnlyProvider extends BaseProvider {
    private chatRefusal;
    chatCompletion(_apiKey: string, _messages: ChatMessage[], _modelId: string, _options?: CompletionOptions): Promise<ChatCompletionResponse>;
    streamChatCompletion(_apiKey: string, _messages: ChatMessage[], _modelId: string, _options?: CompletionOptions): AsyncGenerator<ChatCompletionChunk>;
    /** Shared verdict for a validation probe: 401/403 is a bad key, any other
     *  4xx (usage cap, out of credits, malformed probe) still proves the key
     *  authenticated, and 5xx/transport failures are inconclusive.
     *
     *  Inconclusive cases **throw**, matching #1298's contract and every other
     *  provider (pollinations, kenari, llmtr, google): the health service only
     *  treats a thrown validation as `error`; a returned `{valid:false}` is
     *  recorded as `invalid` and — because disabled keys are skipped by later
     *  passes — permanently benches a working key. A 10 s timeout on a search
     *  call is evidence about the network, not about the key (#1717). */
    protected probe(url: string, init: RequestInit): Promise<KeyValidationResult>;
}
//# sourceMappingURL=search-only.d.ts.map