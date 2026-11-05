import { BaseProvider } from './base.js';
/** Explicitly activated with the normal no-key credential. Decision-only
 * providers must never silently accept a chat completion or send a secret. */
export class KeylessDecisionProvider extends BaseProvider {
    platform;
    name;
    keyless = true;
    constructor(platform, name) {
        super();
        this.platform = platform;
        this.name = name;
    }
    async validateKey() { return true; }
    async chatCompletion(_key, _messages, _model) {
        throw Object.assign(new Error(`${this.name} supports /v1/decisions, not chat completions`), { status: 422 });
    }
    // eslint-disable-next-line require-yield -- refusal must reject on iterator.next()
    async *streamChatCompletion(_key, _messages, _model) {
        throw Object.assign(new Error(`${this.name} supports /v1/decisions, not chat completions`), { status: 422 });
    }
}
//# sourceMappingURL=decision-only.js.map