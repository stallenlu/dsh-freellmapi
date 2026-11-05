/**
 * What the router *claims* and what actually answers are different things.
 *
 * `/v1/models` sets `available` from a database flag — on this machine 54 rows
 * claim to be available while only 22 will produce a completion; the rest fail
 * with 404 (removed upstream), 429 (every key cooling down) or 502 (provider
 * error). A model picker fed from that flag shows a user dozens of dead entries,
 * which is worse than showing fewer.
 *
 * So this module asks each candidate the only question that matters: does a real
 * completion come back. Results are cached to disk because a probe costs seconds
 * per model and the answer is stable for hours.
 *
 * @module lib/probe
 */

import fs from 'node:fs'
import path from 'node:path'

/** A probe older than this no longer decides anything: cooldowns and upstreams move. */
export const PROBE_TTL_MS = 3 * 60 * 60 * 1000

/**
 * How long to wait for one answer.
 *
 * Deliberately generous. `fusion` (a panel of models with a judge) needs 60s+ and
 * a big Qwen took 35s on a warm slot; a 10s timeout would report both as dead and
 * delete working models from the picker.
 */
export const PROBE_TIMEOUT_MS = 90_000

/** Three at a time: the router rate-limits per key, and a wider fan-out times itself out. */
export const PROBE_CONCURRENCY = 3

/** A tiny prompt; the answer is irrelevant, the HTTP status is the whole point. */
const PROBE_PROMPT = 'Reply with exactly OK'

/**
 * A 404 means the upstream no longer serves the model at all. Everything else —
 * 429, 502, a timeout — is a moment, not a fact, so those models stay listed.
 */
const DEAD_STATUS = new Set([404, 422])

export function probePath(dir) {
  return path.join(dir, 'probes.json')
}

/** Read the cache; a missing or corrupt file is simply "nothing probed yet". */
export function readProbeCache(dir) {
  try {
    const raw = JSON.parse(fs.readFileSync(probePath(dir), 'utf8'))
    const results = raw?.results
    if (results === null || typeof results !== 'object' || Array.isArray(results)) return {}
    return results
  } catch {
    return {}
  }
}

/** When the last verdict landed, for a panel that has to say "probed 2h ago". */
export function probeUpdatedAt(dir) {
  try {
    const at = Number(JSON.parse(fs.readFileSync(probePath(dir), 'utf8'))?.updatedAt)
    return Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

export function writeProbeCache(dir, results) {
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${probePath(dir)}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify({ updatedAt: Date.now(), results }, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, probePath(dir))
}

/** Drop every verdict, so the next cycle asks all over again. */
export function clearProbeCache(dir) {
  try {
    fs.rmSync(probePath(dir))
  } catch {
    // Nothing cached is already the wanted state.
  }
}

function fresh(entry, now) {
  return entry !== undefined && typeof entry.at === 'number' && now - entry.at < PROBE_TTL_MS
}

/**
 * Which catalogue rows the DSH model picker should offer.
 *
 * Order of narrowing: a user's own list wins outright; otherwise the router's
 * `available` flag drops the models it knows have no key behind them, and a fresh
 * probe drops the ones that answered 404.
 *
 * @param {object[]} rows adapter catalogue rows (`{ id, available, ... }`)
 * @param {{ enabledModels?: string[], probes?: Record<string, object>, now?: number }} opts
 * @returns {{ rows: object[], claimed: number, dead: number }}
 */
export function selectRows(rows, opts = {}) {
  const now = opts.now ?? Date.now()
  const probes = opts.probes ?? {}
  const enabled = Array.isArray(opts.enabledModels) ? opts.enabledModels.filter((id) => typeof id === 'string') : []
  if (enabled.length > 0) {
    const wanted = new Set(enabled)
    // An id the router stopped listing must not stay in the picker: its entry is
    // kept so the panel can still show it as missing, but discovery drops it.
    return { rows: rows.filter((row) => wanted.has(row.id)), claimed: rows.length, dead: 0 }
  }
  const claimed = rows.filter((row) => row.available !== false)
  const dead = claimed.filter((row) => {
    const hit = probes[row.id]
    return fresh(hit, now) && hit.ok === false && DEAD_STATUS.has(hit.status)
  })
  const deadIds = new Set(dead.map((row) => row.id))
  return { rows: claimed.filter((row) => !deadIds.has(row.id)), claimed: claimed.length, dead: dead.length }
}

/** One row's probe verdict, in the shape the panel renders. */
export function verdictOf(probes, id, now = Date.now()) {
  const hit = probes[id]
  if (!fresh(hit, now)) return { probed: false }
  if (hit.ok === true) return { probed: true, ok: true, ms: hit.ms }
  return { probed: true, ok: false, status: hit.status, note: hit.note ?? '', transient: !DEAD_STATUS.has(hit.status) }
}

/**
 * Ask one model for a completion.
 *
 * Returns the verdict rather than throwing: a probe that fails is the finding,
 * not an error to propagate into a loop over 54 models.
 */
export async function probeOne({ baseURL, apiKey, model, timeoutMs = PROBE_TIMEOUT_MS, userAgent }) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, Math.max(1000, timeoutMs))
  const at = Date.now()
  try {
    const response = await fetch(`${String(baseURL).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(userAgent === undefined ? {} : { 'user-agent': userAgent }),
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: PROBE_PROMPT }], max_tokens: 16, stream: false }),
      signal: controller.signal,
    })
    let note = ''
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      note = text.slice(0, 160)
      return { ok: false, status: response.status, ms: Date.now() - at, note }
    }
    const body = await response.json().catch(() => undefined)
    const content = body?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      // 200 with nothing in it is the harmony-token / dropped-stream case: the
      // model is not dead, it just failed this once.
      return { ok: false, status: 200, ms: Date.now() - at, note: 'empty response' }
    }
    return { ok: true, status: 200, ms: Date.now() - at, served: String(body.model ?? '').slice(0, 60) }
  } catch (error) {
    return { ok: false, status: timedOut ? 0 : -1, ms: Date.now() - at, note: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Probe a batch, writing each verdict to the cache as it lands so a panel
 * refresh mid-run already shows partial truth.
 *
 * @param {object} deps
 * @param {() => { baseURL: string, apiKey: string|undefined }} deps.settings
 * @param {string[]} deps.ids
 * @param {string} deps.dir
 * @param {(id: string, verdict: object) => void} [deps.onOne]
 * @param {() => boolean} [deps.shouldStop]
 */
export async function probeBatch(deps) {
  const queue = [...deps.ids]
  const results = readProbeCache(deps.dir)
  const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      if (deps.shouldStop?.() === true) return
      const id = queue.shift()
      if (id === undefined) return
      const { baseURL, apiKey } = deps.settings()
      if (typeof apiKey !== 'string' || apiKey === '') return
      const verdict = await probeOne({ baseURL, apiKey, model: id, userAgent: deps.userAgent })
      verdict.at = Date.now()
      results[id] = verdict
      deps.onOne?.(id, verdict)
      writeProbeCache(deps.dir, results)
    }
  })
  await Promise.all(workers)
  return results
}
