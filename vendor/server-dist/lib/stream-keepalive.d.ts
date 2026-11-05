/**
 * The keep-alive interval in ms, parsed from STREAM_KEEPALIVE_MS.
 * Unset / empty / 0 / non-numeric / negative → 0 (feature off, default).
 * Positive values are clamped to a 1s floor: a sub-second ping interval just
 * burns bandwidth and adds SSE frames no client asked for.
 */
export declare function streamKeepaliveMs(env?: NodeJS.ProcessEnv): number;
/**
 * Start the keep-alive interval for one stream attempt.
 *
 * - `intervalMs` ≤ 0 disables the feature: no timer is created and the
 *   returned stop function is a no-op.
 * - `isDone` is polled at every tick: once the attempt has finished (response
 *   ended, failed over, or errored), the timer stops itself.
 * - `keepalive` runs on each tick and must write a content-free frame. It is
 *   expected to commit the response first if it has not been committed yet.
 *   Throwing (dead socket) stops the timer without surfacing anything —
 *   the pump's own error paths notice the broken connection.
 *
 * Returns the stop function; call it when the stream ends. Idempotent.
 */
export declare function startStreamKeepalive(intervalMs: number, isDone: () => boolean, keepalive: () => void): () => void;
//# sourceMappingURL=stream-keepalive.d.ts.map