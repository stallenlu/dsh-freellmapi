export declare const DECISION_MODALITY = "decision";
export declare const DECISION_QUESTION_TYPES: readonly ["choice", "noul", "score"];
export type DecisionQuestionType = (typeof DECISION_QUESTION_TYPES)[number];
export interface DecisionQuestion {
    type: DecisionQuestionType;
    instructions: unknown;
    criteria?: unknown;
}
export interface DecisionRequest {
    state: unknown;
    questions: Record<string, DecisionQuestion>;
}
export interface ExtractionRequest {
    state: string;
    fields: Record<string, {
        type: 'text' | 'number';
        instructions?: string;
        decimals?: number;
        unit?: string;
    }>;
    questions?: never;
}
export declare const CLAIRIC_MODEL = "@cf/cloudflare/clairic";
export interface DecisionResponse {
    /** The decision model that answered (its catalog id). */
    model: string;
    provider: string;
    answers: Record<string, unknown>;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    modelVersion?: string;
    truncated?: boolean;
}
export declare class DecisionError extends Error {
    status: number;
    code?: string | undefined;
    retryAfterMs?: number | undefined;
    constructor(message: string, status: number, code?: string | undefined, retryAfterMs?: number | undefined);
}
export interface DecisionOptions {
    /** A decision model id, or 'auto' / undefined for the first one that works. */
    model?: string;
    signal?: AbortSignal;
    /** Overrides the request-scoped client agent (tests, internal callers). */
    clientAgent?: string | null;
    /** With 'auto', leave these platforms out of the chain. Decision routing
     *  (#1354) asks once per chat turn, which BeatAPI's free 1 request/minute
     *  cannot keep up with. A pinned model is never skipped. */
    skipPlatforms?: ReadonlySet<string>;
}
/** Platforms with a decision adapter. catalog-sync gates decisionModels rows
 *  on this, the way SEARCH_ENGINE_PLATFORMS gates search rows. */
export declare const DECISION_PLATFORMS: Set<string>;
/** True when at least one enabled decision model has a usable key. */
export declare function decisionsAvailable(): boolean;
export declare function runDecision(body: DecisionRequest | ExtractionRequest, opts?: DecisionOptions): Promise<DecisionResponse>;
export declare function decisionRetryAfterSec(err: DecisionError): number | undefined;
export interface DecisionModelView {
    id: number;
    platform: string;
    modelId: string;
    displayName: string;
    priority: number;
    enabled: boolean;
    quotaLabel: string;
    contextWindow: number | null;
    keyCount: number;
    healthyKeyCount: number;
    decisionsThisMonth: number;
}
export declare function listDecisionModels(): DecisionModelView[];
/** Turn a decision model on or off. False when the id is not a decision model. */
export declare function setDecisionModelEnabled(id: number, enabled: boolean): boolean;
//# sourceMappingURL=decision.d.ts.map