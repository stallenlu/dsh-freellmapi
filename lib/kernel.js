/**
 * The kernel seam.
 *
 * The only module in the package allowed to name an `@deepseek-ai/*` module, per
 * the ecosystem packaging rule. Everything taken from the harness kernel crosses
 * here, so the rest of the source stays a pure consumer of the structural `ctx`
 * contract and can mount on any kernel line that supplies it.
 *
 * @module lib/kernel
 */

/**
 * Resolve the harness attribution User-Agent.
 *
 * A missing module or an unexpected shape degrades to a literal: attribution must
 * be present on every provider request even when the kernel helper is not.
 *
 * @param {{ debug?: (message: string) => void } | undefined} [logger]
 * @returns {Promise<string>}
 */
export async function resolveAttributionUserAgent(logger) {
  try {
    const module = await import('@deepseek-ai/dsh-llm')
    const headers = typeof module.attributionHeaders === 'function' ? module.attributionHeaders() : undefined
    const agent = headers?.['user-agent'] ?? headers?.['User-Agent']
    if (typeof agent === 'string' && agent !== '') return agent
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger?.debug?.(`dsh-freellmapi: attribution module unavailable (${message})`)
  }
  return 'deepseek-harness (+https://github.com/deepseek-ai/deepseek-harness)'
}
