import { type KeyValidationResult } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const BEATAPI_BASE_URL = "https://api.beatapi.io/v1";
export declare class BeatApiProvider extends OpenAICompatProvider {
    constructor();
    validateKey(apiKey: string): Promise<KeyValidationResult>;
}
//# sourceMappingURL=beatapi.d.ts.map