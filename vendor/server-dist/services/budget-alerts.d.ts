/** Fraction-of-cap points that produce an alert. 1.0 is the hard block; the
 *  whole point is that 0.8 fires while there is still room to act. */
export declare const BUDGET_ALERT_THRESHOLDS: readonly [0.8, 1];
export type BudgetAlertThreshold = (typeof BUDGET_ALERT_THRESHOLDS)[number];
export type BudgetCapKind = 'requests' | 'tokens';
export interface BudgetCrossing {
    threshold: BudgetAlertThreshold;
    kind: BudgetCapKind;
    /** Ledger usage at check time (requests or tokens). */
    used: number;
    /** The configured cap. */
    cap: number;
}
/**
 * Pure crossing decision: given a key's caps and current usage, which alert
 * thresholds are at or over? A cap of 0 means unlimited and never crosses.
 * Kept pure so the arithmetic is testable without a DB.
 */
export declare function budgetThresholdCrossings(caps: {
    requestCap: number;
    tokenCap: number;
}, usage: {
    requests: number;
    tokens: number;
}): BudgetCrossing[];
/**
 * Check one key against its alert thresholds and emit any alert not already
 * fired this month. Never throws: budget alerting must not break the request
 * path it observes.
 */
export declare function noteBudgetAlerts(keyId: number, now?: number): void;
export declare function budgetAlertWebhookUrl(): string | null;
/** Build the webhook payload for one firing batch. Pure so it is testable. */
export declare function budgetWebhookPayload(keyId: number, label: string, platform: string | null, crossings: BudgetCrossing[], now?: number): {
    type: string;
    key_id: number;
    label: string;
    platform: string | null;
    month: string;
    resets_at: string;
    thresholds: {
        kind: BudgetCapKind;
        threshold: 1 | 0.8;
        used: number;
        cap: number;
        blocked: boolean;
    }[];
};
/** Test/admin helper: alerts fired for a key in a month (for assertions). */
export declare function firedBudgetAlerts(keyId: number, now?: number): string[];
//# sourceMappingURL=budget-alerts.d.ts.map