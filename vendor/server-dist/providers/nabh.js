import { providerHttpError } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
export const NABH_BASE_URL = 'https://api.nabh.cloud/v1';
function checkModel(requested, returned) {
    if (requested !== returned) {
        throw Object.assign(new Error('nabh.cloud returned a different or missing model identity'), { status: 502 });
    }
}
/** OpenAI-compatible chat. Only catalog-approved free-plan routes are seeded
 * remotely; /models also lists paid-plan models and is NOT a free-model list.
 * The monthly credits and rate limits are account-wide. X-Balance-INR is an
 * INR wallet balance (including paid top-ups), not a USD or token allowance.
 * Docs: https://nabh.cloud/docs/quickstart/ */
export class NabhProvider extends OpenAICompatProvider {
    constructor() {
        super({ platform: 'nabh', name: 'nabh.cloud', baseUrl: NABH_BASE_URL });
    }
    async validateKey(apiKey, quotaContext) {
        // Verified 2026-10-31: missing/bogus keys return 401; a valid key returns
        // the model list. This read-only check does not spend inference credits.
        const response = await this.fetchModelCatalog(apiKey, quotaContext);
        if ([401, 403].includes(response.status))
            return this.validationResult(response);
        if (!response.ok)
            throw providerHttpError(response, 'nabh.cloud key validation is temporarily inconclusive');
        const body = await response.json().catch(() => null);
        if (!Array.isArray(body?.data)) {
            throw Object.assign(new Error('nabh.cloud returned an invalid model catalog'), { status: 502 });
        }
        return true;
    }
    async chatCompletion(apiKey, messages, modelId, options, quotaContext) {
        const response = await super.chatCompletion(apiKey, messages, modelId, options, quotaContext);
        checkModel(modelId, response.model);
        return response;
    }
    async *streamChatCompletion(apiKey, messages, modelId, options, quotaContext) {
        let identified = false;
        for await (const chunk of super.streamChatCompletion(apiKey, messages, modelId, options, quotaContext)) {
            if (chunk.model || chunk.choices?.length) {
                checkModel(modelId, chunk.model);
                identified = true;
            }
            if (!identified)
                checkModel(modelId, chunk.model);
            yield chunk;
        }
        if (!identified)
            checkModel(modelId, '');
    }
}
//# sourceMappingURL=nabh.js.map