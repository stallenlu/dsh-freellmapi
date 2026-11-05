export interface ModerationModelRow {
    platform: string;
    modelId: string;
    baseUrl: string;
    keyId: number;
    encryptedKey: string;
    iv: string;
    authTag: string;
}
export interface ModerationResult {
    provider: string;
    model: string;
    result: Record<string, unknown>;
}
export declare class ModerationError extends Error {
    status: number;
    /** Seconds the caller should wait before retrying (429 exhaustion). */
    retryAfterSec?: number;
    constructor(message: string, status: number, retryAfterSec?: number);
}
export declare function listModerationModels(): ModerationModelRow[];
export declare function resolveModel(requestedModel: string | undefined): string | null;
export declare function runModerations(model: string | undefined, inputs: string[]): Promise<ModerationResult>;
//# sourceMappingURL=moderation.d.ts.map