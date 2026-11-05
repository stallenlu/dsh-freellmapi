import { type KeyValidationResult } from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
export declare const PLUGSKY_BASE_URL = "https://plugsky.com/v1";
/** Permanent free chat aliases are catalog-managed. Do not discover the whole
 * public roster: it also includes paid and seven-day trial models. */
export declare class PlugskyProvider extends OpenAICompatProvider {
    constructor();
    protected validationResult(response: Response): Promise<KeyValidationResult>;
}
//# sourceMappingURL=plugsky.d.ts.map