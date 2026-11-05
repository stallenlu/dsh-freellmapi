export declare const MIN_CONTEXT_WINDOW_SETTING = "min_context_window";
export declare const MIN_CONTEXT_WINDOW_PRESETS: Record<string, number>;
/** The configured pool floor in tokens, or null when disabled ('off'/unset).
 *  A null context_window on a model means "unknown" and is NEVER filtered —
 *  the same convention fitsContextWindow uses, so models the catalog has no
 *  window for can't be silently mass-excluded by a typo'd floor. */
export declare function minContextWindowFloor(): number | null;
/** True when a model with this advertised window may serve at all under the
 *  configured floor. Unknown windows (null/undefined) always pass. */
export declare function passesContextWindowFloor(contextWindow: number | null | undefined): boolean;
//# sourceMappingURL=min-context-window.d.ts.map