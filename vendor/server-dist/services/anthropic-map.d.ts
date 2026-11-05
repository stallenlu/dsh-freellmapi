import { z } from 'zod';
export declare const CLAUDE_FAMILIES: readonly ["default", "opus", "sonnet", "haiku"];
export type ClaudeFamily = (typeof CLAUDE_FAMILIES)[number];
export type AnthropicModelMap = Record<ClaudeFamily, string>;
export declare const anthropicModelMapSchema: z.ZodObject<{
    default: z.ZodOptional<z.ZodString>;
    opus: z.ZodOptional<z.ZodString>;
    sonnet: z.ZodOptional<z.ZodString>;
    haiku: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    haiku?: string | undefined;
    default?: string | undefined;
    opus?: string | undefined;
    sonnet?: string | undefined;
}, {
    haiku?: string | undefined;
    default?: string | undefined;
    opus?: string | undefined;
    sonnet?: string | undefined;
}>;
export declare const TIER_SELECTORS: readonly ["tier:pro", "tier:mid", "tier:normal"];
export type TierSelector = (typeof TIER_SELECTORS)[number];
export declare function parseTierSelector(value: string): TierSelector | null;
export declare function getClaudeModelMap(): AnthropicModelMap;
export declare function setClaudeModelMap(input: unknown): AnthropicModelMap;
export declare function classifyClaudeFamily(model?: string): ClaudeFamily | null;
export interface ResolvedAnthropicModel {
    preferredModelDbId?: number;
    modelId?: string;
    pinned: boolean;
    tierDbIds?: number[];
}
export declare function resolveAnthropicModel(model?: string): ResolvedAnthropicModel;
export declare const CLAUDE_FAMILY_ALIASES: {
    id: string;
    family: ClaudeFamily;
    label: string;
}[];
/** What an OpenAI-wire route should dispatch a listed Claude alias to. */
export type ClaudeAliasDispatch = {
    kind: 'model';
    modelId: string;
} | {
    kind: 'auto';
} | {
    kind: 'tier';
    dbIds: number[];
};
export declare function resolveListedClaudeAlias(model?: string): ClaudeAliasDispatch | null;
export declare function claudeFamilyDiscoveryEntries(): {
    id: string;
    displayName: string;
}[];
//# sourceMappingURL=anthropic-map.d.ts.map