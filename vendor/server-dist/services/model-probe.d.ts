import type { Scheduler } from '../lib/scheduler.js';
import type { Db } from '../db/types.js';
export declare const MODEL_PROBE_INTERVAL_MS: number;
export declare const MODEL_PROBE_STALE_MS: number;
export declare const RECENT_SERVE_SKIP_MS: number;
export type ModelProbeStatus = 'working' | 'unavailable';
export interface ProbeCandidate {
    keyId: number;
    platform: string;
    modelId: string;
    modelDbId: number;
    endpointScope: string;
}
export interface ProbeOutcome {
    status: ModelProbeStatus | 'error';
    latencyMs?: number;
    error?: string;
}
export interface ProbePassResult {
    probed: ProbeCandidate[];
    outcomes: Array<ProbeCandidate & {
        outcome: ProbeOutcome;
    }>;
}
interface ProbeCandidateRow extends ProbeCandidate {
    lastProbedAt: string | null;
}
export declare function selectProbeCandidates(db: Db, limit: number, now?: number): ProbeCandidateRow[];
export interface ModelProbeRequestDeps {
    chat?: (candidate: ProbeCandidate) => Promise<unknown>;
}
/**
 * Run the probe against one candidate: does this model answer at all?
 * A transport error is 'error' (inconclusive — the network, not the model,
 * failed); any provider rejection (quota, 403/404 on the model) is
 * 'unavailable'. A success is 'working'.
 *
 * Capability classification (tool_capable / chat_only) is a follow-up PR; this
 * pass establishes liveness only.
 *
 * Testable: `chat` replaces the wire call.
 */
export declare function probeModel(candidate: ProbeCandidate, deps?: ModelProbeRequestDeps): Promise<ProbeOutcome>;
export declare function recordProbeResult(db: Db, candidate: ProbeCandidate, outcome: ProbeOutcome, probedAt?: Date): void;
export interface ProbePassOptions extends ModelProbeRequestDeps {
    now?: number;
    jitter?: () => number;
    maxProbes?: number;
    select?: (limit: number, now: number) => ProbeCandidate[];
}
/** One probe pass: probe up to maxProbes stale candidates, record the outcomes.
 *  Exported for tests; production runs it on the scheduler via startModelProbe. */
export declare function runModelProbePass(opts?: ProbePassOptions): Promise<ProbePassResult>;
export declare function startModelProbe(scheduler: Scheduler): void;
export declare function stopModelProbe(): void;
/** Test seam: drop all probe pacing state. */
export declare function resetModelProbeState(): void;
export {};
//# sourceMappingURL=model-probe.d.ts.map