import { getDb } from '../db/index.js';
type RetentionDb = ReturnType<typeof getDb>;
export interface RequestAnalyticsRetentionConfig {
    retentionDays: number;
    maxRows: number;
}
export declare function getRequestAnalyticsRetentionConfig(): RequestAnalyticsRetentionConfig;
export interface ServerLogRetentionConfig {
    retentionDays: number;
    maxRows: number;
}
/** Both knobs env-tunable, 0 on either disables that half. Same convention and
 *  same parser as the analytics pair above. */
export declare function getServerLogRetentionConfig(): ServerLogRetentionConfig;
export interface QuotaObservationRetentionConfig {
    retentionDays: number;
    maxRows: number;
}
/** Same env convention as the pairs above; 0 on either knob disables that half. */
export declare function getQuotaObservationRetentionConfig(): QuotaObservationRetentionConfig;
export interface SearchLogRetentionConfig {
    retentionDays: number;
    maxRows: number;
}
/** Same env convention as the pairs above; 0 on either knob disables that half. */
export declare function getSearchLogRetentionConfig(): SearchLogRetentionConfig;
export interface DecisionLogRetentionConfig {
    retentionDays: number;
    maxRows: number;
}
/** Same env convention as the pairs above; 0 on either knob disables that half. */
export declare function getDecisionLogRetentionConfig(): DecisionLogRetentionConfig;
/**
 * Age- and count-bound the provider quota observation log.
 *
 * provider_quota_state is the source of truth for "how much is left"; this
 * table only explains how it got there. Keeping the newest row per pool is
 * guaranteed by the count bound being far above the number of live pools.
 * created_at is SQLite datetime text, indexed since the 20260901_000002
 * migration, so both deletes are range/ordered walks, not scans. Guarded
 * against the table being absent for the same reason as the hourly prune.
 *
 * Returns how many rows went and whether the sweep finished; `done: false`
 * means the budget ran out and the caller should come back soon.
 */
export declare function pruneQuotaObservations(db: RetentionDb, nowMs: number, budgetMs?: number): {
    deleted: number;
    done: boolean;
};
/**
 * Age- and count-bound the persisted warn/error log rows.
 *
 * Folded into the existing prune pass rather than given a timer of its own: a
 * second interval would be a second thing to start, stop, test and leak in
 * embedders, for a table that grows far slower than `requests` does.
 *
 * Guarded against the table being absent, exactly like the hourly aggregate
 * below — tests that open a DB before migrations run must not crash the prune
 * loop. Rows are deleted by created_at_ms, never by id: the id space is shared
 * with the in-memory ring and is not a timestamp.
 */
export declare function pruneServerLogs(db: RetentionDb, nowMs: number): number;
/**
 * Sweep expired rows from the short-lived replay stores and the session table.
 *
 * idempotency_claims and response_cache are write-once with a TTL that readers
 * already filter on (`expires_at_ms > now`), and both are indexed on
 * `expires_at_ms`. Neither had a sweeper: `storeIdempotencyResult` only deletes
 * expired rows for the SAME key hash it is about to overwrite, so a claim
 * whose hash never repeats — the common case, since clients send a fresh UUID
 * per request — sat in the DB forever with its full response JSON. A busy
 * install replaying Idempotency-Key traffic grew this table monotonically.
 * `response_cache` swept expired rows only at startup, so a long-running
 * server accumulated them between restarts too.
 *
 * `sessions` joins the sweep for the same reason (#1510-era retention series):
 * validateSession only deletes a row when its OWN token is checked again — and
 * an expired token is by definition never re-sent — while login mints a new
 * row per sign-in (30-day TTL). Desktop installs that mint a session on every
 * dashboard load leak one row per load. Expired rows are dead weight for every
 * reader (validateSession filters on expires_at_ms), so deleting them is safe.
 * sessions has no index on expires_at_ms; the delete is a scan of a table that
 * is at most a few hundred rows on any install, once per prune gate.
 *
 * The claims/cache deletes are plain index-range walks over `expires_at_ms`,
 * so cost scales with what is actually expired. Guarded against the tables
 * being absent the same way every other prune here is.
 */
export declare function pruneExpiredClaims(db: RetentionDb, nowMs: number): number;
/**
 * Age- and count-bound the web-search attempt log (#1174).
 *
 * Folded into the same 60s pass as the server logs. search_requests grew on
 * every agent web_search attempt with no prune of any kind; its analytics only
 * answer windows up to 90d ('all' included), so older rows are pure disk
 * growth. Guarded against the table being absent like every other prune here.
 */
export declare function pruneSearchLogs(db: RetentionDb, nowMs: number): number;
/**
 * Age- and count-bound the decision-model attempt log (#1537).
 *
 * decision_requests grew on every POST /v1/decisions attempt (and every failed
 * one — a cooling-down key still logs) with no prune of any kind. Its only
 * reader is the month-scoped count on the Decision page, so the 90d default
 * matches the other attempt logs. Guarded against the table being absent like
 * every other prune here.
 */
export declare function pruneDecisionLogs(db: RetentionDb, nowMs: number): number;
export declare function pruneRequestAnalytics(options?: {
    db?: RetentionDb;
    force?: boolean;
    now?: Date;
}): {
    deleted: number;
    skipped: boolean;
};
export {};
//# sourceMappingURL=request-retention.d.ts.map