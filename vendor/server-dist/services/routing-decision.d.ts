import type { ChatMessage } from '@freellmapi/shared/types.js';
import type { PresetStrategy } from './scoring.js';
export declare const DECISION_PRESETS: readonly PresetStrategy[];
export declare const DEFAULT_MIN_PROBABILITY = 0.5;
export declare const DECISION_TIMEOUT_MS = 1500;
/** Logged as the decision's client so Models → Decision shows routing usage. */
export declare const ROUTER_CLIENT = "freellmapi-router";
export interface DecisionRoutingSettings {
    /** A decision model id, or 'auto' (first available, BeatAPI skipped). */
    model: string;
    /** 0..1: below this top probability the request routes as Balanced. */
    minProbability: number;
}
export declare function getDecisionRoutingSettings(): DecisionRoutingSettings;
export declare function setDecisionRoutingSettings(patch: Partial<DecisionRoutingSettings>): void;
export type DecisionPickSource = 'decision' | 'cache' | 'low_confidence' | 'timeout' | 'unavailable' | 'error';
export interface DecisionPick {
    strategy: PresetStrategy;
    source: DecisionPickSource;
    /** The top probability the decision model gave (absent on fallback). */
    probability?: number;
    /** The decision model that answered. */
    model?: string;
}
export declare function resetDecisionRoutingCache(): void;
export declare function getDecisionRoutingStats(): {
    counts: {
        balanced: number;
        smartest: number;
        fastest: number;
        reliable: number;
    };
    fallbacks: {
        error?: number | undefined;
        low_confidence?: number | undefined;
        unavailable?: number | undefined;
        decision?: number | undefined;
        timeout?: number | undefined;
        cache?: number | undefined;
    };
    recent: (DecisionPick & {
        at: number;
    })[];
};
/** The system prompt's opening plus the latest user message, bounded so a huge
 *  conversation never turns into a huge decision prompt. Empty when there is
 *  no user text to judge (nothing to decide on: route as Balanced). */
export declare function decisionStateFor(messages: readonly ChatMessage[]): string;
/** Ask the decision model which preset fits this request. Never throws: every
 *  failure is a Balanced pick with the reason in `source`. */
export declare function chooseRoutingPreset(messages: readonly ChatMessage[], signal?: AbortSignal): Promise<DecisionPick>;
/**
 * Called by the chat surfaces before routing. When the 'decision' strategy is
 * active and the request did not pin a model, picks the preset for this
 * request and stores it on the request context for the router. Returns the
 * pick (for the X-FreeLLM-Routing-Strategy header), or null when the strategy
 * is something else or the request pins a model.
 */
export declare function applyDecisionRouting(messages: readonly ChatMessage[], opts?: {
    pinned?: boolean;
    preset?: PresetStrategy;
    signal?: AbortSignal;
}): Promise<DecisionPick | null>;
/** Header value: the preset, plus why when it is a fallback. */
export declare function routingStrategyHeader(pick: DecisionPick): string;
/** Settings + since-boot stats for the dashboard, plus what the setup guide
 *  needs. Mirrors the chain routing would use: the pinned model, or with
 *  'auto' every enabled decision model except the skipped platforms.
 *  - `ready`: one of those has a usable key (else every request is Balanced).
 *  - `hasModels`: there is at least one such model to add a key for.
 *  - `keyPlatforms`: providers whose key would make it ready, in priority order. */
export declare function getDecisionRoutingStatus(): {
    counts: {
        balanced: number;
        smartest: number;
        fastest: number;
        reliable: number;
    };
    fallbacks: {
        error?: number | undefined;
        low_confidence?: number | undefined;
        unavailable?: number | undefined;
        decision?: number | undefined;
        timeout?: number | undefined;
        cache?: number | undefined;
    };
    recent: (DecisionPick & {
        at: number;
    })[];
    ready: boolean;
    hasModels: boolean;
    keyPlatforms: string[];
    /** A decision model id, or 'auto' (first available, BeatAPI skipped). */
    model: string;
    /** 0..1: below this top probability the request routes as Balanced. */
    minProbability: number;
};
//# sourceMappingURL=routing-decision.d.ts.map