/**
 * The FreeLLMAPI model provider.
 *
 * One route fronts the whole router, so the model list is discovered live from
 * the router itself rather than declared here: `/v1/models` reports every id the
 * local instance can reach today, and that list changes as providers come and go.
 *
 * @module lib/adapter
 */

import { resolveAttributionUserAgent } from './kernel.js'
import { repairToolPairing, toChatMessages, toToolDefs } from './chat.js'
import { ApiError, CODE, failFromResponse, readChatStream } from './stream.js'

export const ROUTE = 'freellmapi'

/** The router's virtual model: it picks a live candidate per request. */
export const AUTO_MODEL = 'auto'

/**
 * Models whose names promise more than the router can keep.
 *
 * `claude-*`, `gpt-*` and friends exist as *slots*: a request naming one is
 * re-routed to whatever free model the router ranks best that moment. Presenting
 * them as first-class entries with a promised context window would misrepresent
 * both the model and the budget, so their real limits are left to the router.
 */
const SLOT_PATTERN = /^(claude|gpt-|gemini|o[134]-|grok)/i

/** The router can be slow to first token; the harness default of 5 min is plenty. */
const IDLE_TIMEOUT_MS = 300_000

/**
 * How long a catalogue read is reused.
 *
 * One completion resolves the catalogue twice (metadata, then the prepared call)
 * and the panel asks on every open, so a short cache keeps a normal conversation
 * from tripping the router's own per-minute limit. Ten seconds collapses a burst
 * while still showing a key added in the dashboard without a restart.
 */
const CATALOG_TTL_MS = 10_000

/**
 * Reasoning levels advertised for every model.
 *
 * The router forwards an effort hint where the free model behind it understands
 * one and ignores it otherwise, so these are hints, not promises.
 */
const REASONING_EFFORTS = Object.freeze([
  Object.freeze({ id: 'low', name: 'Low' }),
  Object.freeze({ id: 'medium', name: 'Medium' }),
  Object.freeze({ id: 'high', name: 'High' }),
])

export class FreeLlmApiAdapter {
  /**
   * @param {object} deps
   * @param {() => { baseURL: string, apiKey: string | undefined, defaultMaxTokens: number, requestTimeoutMs: number }} deps.settings
   * @param {{ debug?: (m: string) => void, warn?: (m: string) => void }} [deps.logger]
   */
  constructor(deps) {
    this.deps = deps
    this.userAgent = undefined
    /** @type {Map<string, {at: number, rows: object[]}>} */
    this.catalogCache = new Map()
  }

  providerInfo(provider) {
    return { id: provider, name: 'FreeLLMAPI' }
  }

  /**
   * Retry policy, flattened.
   *
   * A 429 from this router means every candidate is cooling down, which resolves
   * on its own — worth retrying. `EMPTY_RESPONSE` is the harmony-token and
   * dropped-stream case that a second attempt usually clears.
   *
   * @returns {Readonly<object>}
   */
  providerRetryPolicy() {
    return Object.freeze({
      mode: 'normal',
      maxRetries: 2,
      retryableCodes: Object.freeze([CODE.empty, CODE.server, CODE.timeout, CODE.transport, CODE.rateLimit]),
      initialDelayMs: 900,
      maxDelayMs: 8000,
      jitterRatio: 0.2,
    })
  }

  /**
   * Pricing is unknown for a free router, and this call is synchronous inside the
   * token meter, so it must not touch the network. Zero is the honest answer.
   */
  imageRequestPricing(_provider, _model) {
    return { inputTokens: 0, outputTokens: 0 }
  }

  async attribution() {
    if (this.userAgent === undefined) this.userAgent = await resolveAttributionUserAgent(this.deps.logger)
    return this.userAgent
  }

  /** Router-reported catalogue, for the model picker. */
  async listModels(provider) {
    const { baseURL, apiKey, defaultMaxTokens } = this.deps.settings()
    const rows = await this.fetchCatalog(baseURL, apiKey)
    return rows.map((row) => ({
      provider,
      id: row.id,
      name: row.name,
      description: describeRow(row),
      inputModalities: ['text'],
      // The picker shows this number, so it has to be the one a request will
      // actually get — same calculation as metadataOf, not a guess.
      contextWindow: this.metadataOf(provider, row, defaultMaxTokens).context.contextWindow,
    }))
  }

  /**
   * One exact model's metadata, in the shape the harness validates with
   * `normalizeModelInfo`. `prepareCall` must return this same shape: the
   * harness normalizes `prepareCall().model` too, not just `resolveModel()`.
   */
  metadataOf(provider, row, defaultMaxTokens) {
    // A slot's advertised window belongs to the free model behind it at that
    // instant; only real ids get to promise a fixed budget.
    const declared = SLOT_PATTERN.test(row.id) ? 0 : Number(row.contextWindow) || 0
    const contextWindow = declared > 0 ? declared : 131_072
    return {
      provider,
      id: row.id,
      name: row.name,
      inputModalities: ['text'],
      context: { contextWindow },
      defaultMaxTokens: Math.min(defaultMaxTokens, contextWindow),
      // The harness validates each effort as `{id, name}`; a bare string is
      // rejected as INVALID_MODEL_REASONING before any request is made.
      reasoning: {
        efforts: REASONING_EFFORTS,
        defaultEffort: 'medium',
      },
    }
  }

  /** Look one exact id up in the live catalogue; both entry points need it. */
  async rowOf(baseURL, apiKey, model) {
    const rows = await this.fetchCatalog(baseURL, apiKey)
    const row = rows.find((entry) => entry.id === model)
    if (row === undefined) {
      throw new ApiError(`FreeLLMAPI does not offer a model named "${model}" right now`, 'UNKNOWN_MODEL')
    }
    return row
  }

  async resolveModel(provider, model) {
    const { baseURL, apiKey, defaultMaxTokens } = this.deps.settings()
    const row = await this.rowOf(baseURL, apiKey, model)
    return this.metadataOf(provider, row, defaultMaxTokens)
  }

  async prepareCall(provider, model) {
    const { baseURL, apiKey, defaultMaxTokens } = this.deps.settings()
    const row = await this.rowOf(baseURL, apiKey, model)
    const snapshot = this.metadataOf(provider, row, defaultMaxTokens)
    return {
      model: snapshot,
      stream: (options) => this.stream(options, snapshot),
    }
  }

  /**
   * One HTTP attempt. The harness owns retries: this method never loops.
   */
  async *stream(options, entry) {
    const { baseURL, apiKey, requestTimeoutMs } = this.deps.settings()
    if (typeof apiKey !== 'string' || apiKey === '') {
      throw new ApiError(
        'no FreeLLMAPI unified key is configured; add one in the plugin settings',
        CODE.credential,
      )
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, Math.max(1000, requestTimeoutMs))
    const forward = () => controller.abort()
    options.signal?.addEventListener('abort', forward, { once: true })
    const cleanup = () => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', forward)
    }

    const warnings = []
    const repaired = repairToolPairing(options.messages ?? [])
    const chat = toChatMessages(repaired, this.deps.resolveImage, warnings)
    if (warnings.length > 0) this.deps.logger?.debug?.(`freellmapi: ${warnings.join(', ')}`)

    const payload = {
      model: entry.id,
      messages:
        typeof options.system === 'string' && options.system !== ''
          ? [{ role: 'system', content: options.system }, ...chat]
          : chat,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: Math.min(
        Number(options.maxTokens) || entry.defaultMaxTokens,
        entry.defaultMaxTokens,
      ),
    }
    if (typeof options.temperature === 'number' && Number.isFinite(options.temperature)) {
      payload.temperature = options.temperature
    }
    if (Array.isArray(options.stop) && options.stop.length > 0) payload.stop = options.stop
    // Not honouring a stop sequence silently would change the answer's meaning,
    // so an unsupported shape is refused instead.
    if (options.stop !== undefined && !Array.isArray(options.stop)) {
      throw new ApiError('FreeLLMAPI only supports an array of stop sequences', CODE.unsupported)
    }

    const tools = toToolDefs(options.tools)
    if (tools.length > 0) payload.tools = tools

    let response
    try {
      response = await fetch(`${trimSlash(baseURL)}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          authorization: `Bearer ${apiKey}`,
          'user-agent': await this.attribution(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (error) {
      cleanup()
      if (timedOut) throw new ApiError('FreeLLMAPI did not answer in time', CODE.timeout)
      if (controller.signal.aborted) throw new ApiError('request aborted', CODE.aborted)
      throw new ApiError(`cannot reach FreeLLMAPI at ${baseURL}: ${message(error)}`, CODE.transport)
    }

    if (!response.ok) {
      try {
        await failFromResponse(response)
      } catch (error) {
        cleanup()
        if (timedOut) throw new ApiError('FreeLLMAPI did not answer in time', CODE.timeout)
        throw error
      }
    }

    try {
      yield* readChatStream(response, controller.signal)
    } catch (error) {
      if (timedOut) throw new ApiError('FreeLLMAPI stopped responding', CODE.timeout)
      throw error
    } finally {
      cleanup()
    }
  }

  /**
   * Read and normalise the router's catalogue.
   *
   * One completion resolves the catalogue twice (metadata, then the prepared
   * call) and the panel asks on every open, so a short cache keeps a normal
   * conversation from tripping the router's own per-minute limit. Ten seconds
   * is long enough to collapse a burst and short enough that a key added in the
   * dashboard shows up without a restart.
   */
  async fetchCatalog(baseURL, apiKey) {
    // A cold start has neither a key nor a listener: the router mints its key on
    // first boot, so asking it to come up is what makes this call possible. Do
    // it before the key check, then re-read settings to pick the minted key up.
    if (this.deps.ensureUp !== undefined && (typeof apiKey !== 'string' || apiKey === '')) {
      await this.deps.ensureUp()
      ;({ baseURL, apiKey } = this.deps.settings())
    }
    if (typeof apiKey !== 'string' || apiKey === '') {
      throw new ApiError(
        'no FreeLLMAPI unified key is configured; add one in the plugin settings',
        CODE.credential,
      )
    }
    const stamp = `${baseURL}\u0000${apiKey}`
    const hit = this.catalogCache.get(stamp)
    if (hit !== undefined && Date.now() - hit.at < CATALOG_TTL_MS) return hit.rows
    let rows
    try {
      rows = await this.readCatalog(baseURL, apiKey)
    } catch (error) {
      // A router that was running when the key was read can stop between calls;
      // one restart attempt is cheaper than showing the picker an empty list.
      if (this.deps.ensureUp === undefined || error?.code !== CODE.transport) throw error
      await this.deps.ensureUp()
      ;({ baseURL, apiKey } = this.deps.settings())
      rows = await this.readCatalog(baseURL, apiKey)
    }
    this.catalogCache.set(`${baseURL}\u0000${apiKey}`, { at: Date.now(), rows })
    return rows
  }

  /** Forget the cached catalogue: a person who just saved settings expects a fresh read. */
  invalidateCatalog() {
    this.catalogCache.clear()
  }

  async readCatalog(baseURL, apiKey) {
    let response
    try {
      response = await fetch(`${trimSlash(baseURL)}/models`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'user-agent': await this.attribution(),
        },
      })
    } catch (error) {
      throw new ApiError(`cannot reach FreeLLMAPI at ${baseURL}: ${message(error)}`, CODE.transport)
    }
    if (!response.ok) await failFromResponse(response)
    const body = await response.json()
    const rows = Array.isArray(body?.data) ? body.data : []
    return rows
      .filter((row) => typeof row?.id === 'string' && row.id !== '')
      .map((row) => ({
        id: row.id,
        name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id,
        contextWindow: Number(row.context_window ?? row.context_length) || 0,
        available: row.available !== false,
        unavailableReason: typeof row.unavailable_reason === 'string' ? row.unavailable_reason : '',
      }))
  }
}

export { IDLE_TIMEOUT_MS }

function describeRow(row) {
  const parts = []
  if (row.contextWindow > 0) parts.push(`${Math.round(row.contextWindow / 1024)}K context`)
  if (row.available === false) parts.push(row.unavailableReason || 'unavailable')
  return parts.join(' · ')
}

function trimSlash(value) {
  return String(value).replace(/\/+$/, '')
}

function message(error) {
  return error instanceof Error ? error.message : String(error)
}
