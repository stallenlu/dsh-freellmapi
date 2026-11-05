import { type CooldownSource } from './ratelimit.js';
/** Account id of a Cloudflare key ("account_id:api_token"), or null. */
export declare function cloudflareAccountId(apiKey: string): string | null;
/** Only a Workers AI daily *neurons* 429 means the whole account is spent. */
export declare function isCloudflareNeuronsExhausted(err: {
    status?: number;
    message?: string;
} | null | undefined): boolean;
/**
 * Bench the whole Cloudflare account behind `apiKey` after a daily neurons
 * 429. Returns the number of model+key cooldowns written (0 when the error is
 * not a neurons exhaustion or the key has no account id).
 */
export declare function benchCloudflareAccount(apiKey: string, err: {
    status?: number;
    message?: string;
} | null | undefined, durationMs: number, source: CooldownSource): number;
/**
 * Bench every enabled Cloudflare model on every key of `account` (lowercase
 * account id). Shared by the 429 path above and the local neuron meter
 * (cloudflare-neurons.ts), which benches until midnight UTC once the account
 * reaches its daily neuron cap. Returns the number of cooldowns written.
 */
export declare function benchCloudflareAccountId(account: string, durationMs: number, source: CooldownSource): number;
//# sourceMappingURL=cloudflare-daily-quota.d.ts.map