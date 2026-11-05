export declare const CLOUDFLARE_FREE_NEURONS_PER_DAY = 10000;
export declare const DEFAULT_CLOUDFLARE_DAILY_NEURON_CAP = 9000;
/** Workers AI prices in USD, from GET /accounts/{id}/ai/models/search
 *  (`price` property) on 2026-11-04. Token prices are per million tokens. A
 *  model missing here is charged the conservative defaults below. */
export interface CloudflarePrice {
    inputPerM?: number;
    outputPerM?: number;
    perRequest?: number;
    perStep?: number;
    perTile?: number;
    perAudioMinute?: number;
    per1kChars?: number;
}
export declare const CLOUDFLARE_PRICES: Record<string, CloudflarePrice>;
/** What a Cloudflare call used (or is expected to use). */
export interface NeuronUsage {
    inputTokens?: number;
    outputTokens?: number;
    steps?: number;
    tiles?: number;
    audioMinutes?: number;
    characters?: number;
}
/** Neurons Cloudflare charges for `usage` on `modelId`. */
export declare function neuronsFor(modelId: string, usage: NeuronUsage): number;
/** The per-account daily neuron cap, or null when the operator turned it off. */
export declare function getCloudflareDailyNeuronCap(): number | null;
export declare function msUntilUtcMidnight(now?: number): number;
/** Neurons this install has charged the account today (estimates included). */
export declare function localNeuronsToday(account: string, now?: number): number;
/** Neurons the account has used today: the higher of our ledger and Cloudflare's own count. */
export declare function cloudflareNeuronsUsedToday(account: string, now?: number): number;
export interface CloudflareNeuronStatus {
    used: number;
    cap: number | null;
    remote: number | null;
    resetsAt: string;
}
export declare function cloudflareNeuronStatus(apiKey: string, now?: number): CloudflareNeuronStatus | null;
/** False once the key's account has reached today's neuron cap. */
export declare function cloudflareNeuronsAvailable(apiKey: string, now?: number): boolean;
export declare class CloudflareNeuronCapError extends Error {
    readonly status = 429;
    readonly retryAfterSec: number;
    constructor(used: number, cap: number, now: number);
}
export interface CloudflareCallEstimate extends NeuronUsage {
    /** The request's max_tokens, when the client sent one. Bounds the output guess. */
    maxOutputTokens?: number;
}
export interface CloudflareNeuronCall {
    /** The call completed: replace the estimate with what it really used. Pass
     *  null when the real usage is unknown (the estimate stays). */
    settle(actual: NeuronUsage | null): void;
    /** The call was cut short: charge what it used so far, but never less than
     *  the estimate (Cloudflare may have kept generating after we hung up). */
    settleAtLeast(partial: NeuronUsage): void;
    /** Cloudflare refused the call before running it (an HTTP error answer):
     *  nothing was billed, so take the estimate back. */
    refund(): void;
}
/**
 * Charge a Cloudflare call's estimated neurons before it is dispatched. Throws
 * CloudflareNeuronCapError when the account has no room left today (and
 * benches the account until midnight UTC so the router stops offering it).
 */
export declare function startCloudflareCall(apiKey: string, modelId: string, estimate: CloudflareCallEstimate, now?: number): CloudflareNeuronCall;
/**
 * Ask Cloudflare's GraphQL analytics how many neurons the account used today
 * and store it. Needs the token's "Account Analytics: Read" permission; a
 * token without it is left alone for six hours. Returns the count, or null.
 */
export declare function refreshRemoteNeurons(apiKey: string, now?: number): Promise<number | null>;
/** Test hook: forget remote-check timers. */
export declare function resetCloudflareNeuronMeter(): void;
/**
 * Run one Cloudflare call under the meter: charge the estimate, refund it when
 * Cloudflare answered with an HTTP error (nothing ran), keep it when the call
 * died without an answer (timeout, transport: Cloudflare may still bill), and
 * settle on `actualOf(result)` when it completed. `wrapCapError` turns the
 * meter's own refusal into the caller's error type so its usual 429 handling
 * (cooldown, next key) applies.
 */
export declare function meterCloudflare<T>(apiKey: string, modelId: string, estimate: CloudflareCallEstimate, run: () => Promise<T>, actualOf: (result: T) => NeuronUsage | null, wrapCapError?: (err: CloudflareNeuronCapError) => Error): Promise<T>;
/** ~4 characters a token, the same rough count the router uses. */
export declare function roughTokens(text: string): number;
//# sourceMappingURL=cloudflare-neurons.d.ts.map