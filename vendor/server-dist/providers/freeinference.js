import { OpenAICompatProvider } from './openai-compat.js';
export const FREEINFERENCE_BASE_URL = 'https://freeinference.org/v1';
function checkRequest(key, model) {
    if (!key.trim() || key === 'no-key')
        throw Object.assign(new Error('FreeInference API key is required'), { status: 401 });
    if (model !== 'qwen3.6-35b')
        throw Object.assign(new Error('FreeInference chat supports only the tested Qwen3.6 35B route'), { status: 400 });
}
function checkIdentity(requested, returned) {
    if (returned !== requested)
        throw Object.assign(new Error('FreeInference returned a different or missing model identity'), { status: 502 });
}
/** Research service: prompts/responses are logged. Account access varies and
 * chat/embeddings share a daily quota, reset at 00:00 UTC. No model seeds:
 * only the signed catalog may deliver rows through the existing tier gate.
 * Docs: https://doc.freeinference.org/models and /agents */
export class FreeInferenceProvider extends OpenAICompatProvider {
    constructor() { super({ platform: 'freeinference', name: 'FreeInference', baseUrl: FREEINFERENCE_BASE_URL }); }
    get supportsKeyValidation() { return false; }
    async validateKey(apiKey) {
        if (!apiKey.trim())
            return { valid: false, error: 'FreeInference API key is required' };
        // Live-verified 2026-11-04: /models returns 200 for missing AND bogus keys.
        // Never label these keys healthy or repeatedly spend inference to probe.
        throw new Error('FreeInference has no verified credential-validation endpoint; validity is determined by real requests');
    }
    fetchWithTimeout(url, init, timeoutMs, fetchOpts) {
        // Match the tested non-streaming wire shape without changing other providers.
        if (url === `${FREEINFERENCE_BASE_URL}/chat/completions` && typeof init.body === 'string') {
            const body = JSON.parse(init.body);
            init = { ...init, body: JSON.stringify({ stream: false, ...body }) };
        }
        return super.fetchWithTimeout(url, { ...init, redirect: 'error' }, timeoutMs, fetchOpts);
    }
    async chatCompletion(apiKey, messages, modelId, options, quotaContext) {
        checkRequest(apiKey, modelId);
        const response = await super.chatCompletion(apiKey, messages, modelId, options, quotaContext);
        checkIdentity(modelId, response.model);
        return response;
    }
    async *streamChatCompletion(apiKey, messages, modelId, options, quotaContext) {
        checkRequest(apiKey, modelId);
        let identified = false;
        for await (const chunk of super.streamChatCompletion(apiKey, messages, modelId, options, quotaContext)) {
            if (chunk.model || chunk.choices?.length || !identified) {
                checkIdentity(modelId, chunk.model);
                identified = true;
            }
            yield chunk;
        }
        if (!identified)
            checkIdentity(modelId, undefined);
    }
}
//# sourceMappingURL=freeinference.js.map