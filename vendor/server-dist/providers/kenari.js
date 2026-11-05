import { providerHttpError } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
export const KENARI_BASE_URL = 'https://kenari.id/v1';
function upstreamError(message) {
    return Object.assign(new Error(`Kenari ${message}`), { status: 502 });
}
export function requireKenariFreeModel(modelId) {
    if (!modelId.endsWith(':free')) {
        throw Object.assign(new Error('Kenari requires an explicit :free model route'), { status: 400 });
    }
}
function checkModel(requested, returned) {
    if (returned !== requested)
        throw upstreamError('returned a different or missing model identity');
}
/** Named :free routes share the account's renewable daily quota. Never strip
 * the suffix, discover the paid roster, or retry a paid route. Model rows are
 * delivered only by the signed catalog. Docs: https://kenari.id/en/docs. */
export class KenariProvider extends OpenAICompatProvider {
    constructor() {
        super({ platform: 'kenari', name: 'Kenari', baseUrl: KENARI_BASE_URL,
            validateUrl: `${KENARI_BASE_URL}/account/balance`, timeoutMs: 90_000 });
    }
    fetchWithTimeout(url, init, timeoutMs, options) {
        return super.fetchWithTimeout(url, { ...init, redirect: 'error' }, timeoutMs, options);
    }
    async validationResult(response) {
        if (response.status === 401)
            return super.validationResult(response);
        // Restricted/shared keys cannot read account balance (403); this is not
        // proof the key is invalid. Quota failures and outages are inconclusive too.
        if (!response.ok)
            throw providerHttpError(response, 'Kenari key validation is temporarily inconclusive');
        const body = await response.json().catch(() => null);
        if (body?.object !== 'account.balance' || body.error ||
            typeof body.available_micro_idr !== 'number' || !Number.isFinite(body.available_micro_idr)) {
            throw upstreamError('returned an invalid account balance');
        }
        return true; // A zero balance is valid for :free models.
    }
    async chatCompletion(apiKey, messages, modelId, options, quotaContext) {
        requireKenariFreeModel(modelId);
        const response = await super.chatCompletion(apiKey, messages, modelId, options, quotaContext);
        checkModel(modelId, response.model);
        if (!response.choices?.some(c => (typeof c.message?.content === 'string' && c.message.content.trim()) || c.message?.tool_calls?.length)) {
            throw upstreamError('returned an empty completion');
        }
        return response;
    }
    async *streamChatCompletion(apiKey, messages, modelId, options, quotaContext) {
        requireKenariFreeModel(modelId);
        let started = false;
        const preamble = [];
        for await (const chunk of super.streamChatCompletion(apiKey, messages, modelId, options, quotaContext)) {
            if ('error' in chunk || !Array.isArray(chunk.choices))
                throw upstreamError('returned a malformed stream event');
            // A usage-only terminal event may omit model; every other event must
            // retain the exact requested route before any bytes reach the client.
            if (chunk.model || chunk.choices.length)
                checkModel(modelId, chunk.model);
            if (!started) {
                preamble.push(chunk);
                const usable = chunk.choices.some(c => (typeof c.delta?.content === 'string' && c.delta.content.trim()) || c.delta?.tool_calls?.length);
                if (!usable) {
                    if (preamble.length >= 64)
                        throw upstreamError('returned an empty stream preamble');
                    continue;
                }
                started = true;
                yield* preamble;
                preamble.length = 0;
            }
            else
                yield chunk;
        }
        // Empty 200 streams were observed live. Do not commit their role/finish
        // frames, so the normal router can still fail over to another route.
        if (!started)
            throw upstreamError('returned an empty completion stream');
    }
}
//# sourceMappingURL=kenari.js.map