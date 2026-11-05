import type { ChatMessage } from '@freellmapi/shared/types.js';
/**
 * False when this machine is known to be unable to run sharp's prebuilt
 * libvips: linux-x64 whose /proc/cpuinfo flags lack sse4_2. Anything we cannot
 * read or recognise counts as capable, which keeps today's behaviour.
 */
export declare function cpuCanRunSharp(platform?: string, arch?: string, readCpuinfo?: () => string): boolean;
export interface ImageNormalizeOptions {
    enabled?: boolean;
    maxDimension?: number;
    thresholdBytes?: number;
    quality?: number;
}
export interface ImageNormalizeSummary {
    messages: ChatMessage[];
    /** Number of images actually re-encoded. */
    normalized: number;
    bytesBefore: number;
    bytesAfter: number;
}
/**
 * Downscale + re-encode over-threshold inline images across a chat-message
 * list. Pure with respect to everything but the image blocks themselves
 * (text, tool calls, detail hints, block order all untouched). Never throws.
 */
export declare function normalizeMessageImages(messages: ChatMessage[], overrides?: ImageNormalizeOptions): Promise<ImageNormalizeSummary>;
//# sourceMappingURL=image-normalize.d.ts.map