/**
 * The router's own ranking numbers, read straight out of its database.
 *
 * The bundled dashboard at `http://127.0.0.1:3001` scores every model with
 * three axes (reliability / speed / intelligence) and one combined score, and
 * that table is the single most useful thing the dashboard shows. The native
 * panel cannot borrow it: the dashboard is a separate SPA behind its own session
 * cookie and its own `frame-ancestors 'self'` CSP, so the numbers have to be
 * recomputed here rather than embedded.
 *
 * They are not recomputed *by hand*. `vendor/server-dist` is the router's own
 * source, already shipped inside this plugin, and two of its exports are exactly
 * the dashboard's computation:
 *
 * - `getModelGroups()` gives the canonical ids the model list is keyed by. Those
 *   ids are group slugs (`gpt-oss-120b`), not `models.model_id` values, so a
 *   naive join against the catalogue is wrong for two thirds of the rows.
 * - `getRoutingScores()` is the scoring pass the dashboard table itself renders.
 *
 * Using them keeps this panel honest: same weights, same statistics, same answer
 * as the browser tab, with no second implementation to drift.
 *
 * @module lib/ranking
 */

import fs from 'node:fs'

/** Scores move with every request, but the panel does not need them live. */
const CACHE_TTL_MS = 60_000

const VENDOR = new URL('../vendor/server-dist/', import.meta.url)

/** Last good read, so a status poll does not re-run the scoring pass. */
let cache = { at: 0, dbPath: '', value: undefined }

/**
 * Shape a read-only `node:sqlite` handle into the narrow adapter contract
 * `connectDb` expects. A bare `DatabaseSync` is not accepted: the router's own
 * adapter exposes `pragma()` and `transaction()`, and `connectDb` calls them.
 */
function readOnlyAdapter(DatabaseSync, dbPath) {
  const raw = new DatabaseSync(dbPath, { readOnly: true })
  const wrap = (statement) => ({
    get: (...args) => statement.get(...args),
    all: (...args) => statement.all(...args),
    run: (...args) => statement.run(...args),
  })
  return {
    name: dbPath,
    memory: false,
    prepare: (sql) => wrap(raw.prepare(sql)),
    exec: (sql) => raw.exec(sql),
    // connectDb pokes `journal_mode` and `busy_timeout`; reading them back is
    // enough, and a read-only handle must not be asked to change anything.
    pragma: (source) => raw.prepare(`PRAGMA ${source}`).all(),
    close: () => raw.close(),
    transaction: (fn) => fn,
  }
}

/**
 * `connectDb(':memory:', ...)` is the only entry point that both accepts a
 * custom factory and skips the side effects a read-only caller must not have:
 * on a real path it would set `journal_mode = WAL` and tighten the file ACLs
 * (icacls on Windows) of the router's live database. The memory path skips both,
 * while the factory below still opens the real database — read-only.
 */
function openReadOnly(connectDb, DatabaseSync, dbPath) {
  return connectDb(':memory:', {
    ensureDir: false,
    factory: () => readOnlyAdapter(DatabaseSync, dbPath),
  })
}

function round(value, digits = 3) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.round(value * 1000) / 10
}

/**
 * Collapse a model group into the row the panel draws.
 *
 * A group is the same model served by several platforms. The score shown is the
 * best one, because that is the platform the router would actually pick, and
 * averaging would describe a route that cannot happen. Platforms, tools and
 * vision are unioned so "this model is reachable" stays true for the group.
 */
function describeGroup(group, meta, scores) {
  const members = Array.isArray(group.members) ? group.members : []
  if (members.length === 0) return undefined
  const platforms = []
  let best
  let intelligenceRank = Infinity
  let requests = 0
  let contextWindow = 0
  let tools = false
  let vision = false
  for (const member of members) {
    if (!platforms.includes(member.platform)) platforms.push(member.platform)
    const rank = member.intelligence_rank
    if (typeof rank === 'number' && rank < intelligenceRank) intelligenceRank = rank
    const scored = scores.get(member.model_db_id)
    if (scored !== undefined) {
      requests += Number(scored.totalRequests) || 0
      if (best === undefined || scored.score > best.score) best = scored
    }
    const row = meta.get(member.model_db_id)
    if (row === undefined) continue
    if ((row.context_window ?? 0) > contextWindow) contextWindow = row.context_window
    if (row.supports_tools === 1) tools = true
    if (row.supports_vision === 1) vision = true
  }
  // Rate limits belong to whichever platform wins the route: that ceiling is the
  // one a caller hits first, so it is the one worth showing.
  const winner = best === undefined ? undefined : meta.get(best.modelDbId)
  return {
    // 0-1, exactly as the dashboard renders `score.toFixed(3)`.
    score: round(best?.score),
    reliability: round(best?.reliability),
    speed: round(best?.speed),
    intelligence: round(best?.intelligence),
    // The same three numbers as 0-100, so the bars and the score cannot disagree
    // with each other. Undefined stays undefined: a model with no history gets no
    // bar rather than a fake zero.
    stability: percent(best?.reliability),
    speedPct: percent(best?.speed),
    intelligencePct: percent(best?.intelligence),
    requests,
    platforms,
    intelligenceRank: Number.isFinite(intelligenceRank) ? intelligenceRank : undefined,
    contextWindow,
    rpmLimit: winner?.rpm_limit ?? 0,
    rpdLimit: winner?.rpd_limit ?? 0,
    tpmLimit: winner?.tpm_limit ?? 0,
    tpdLimit: winner?.tpd_limit ?? 0,
    tools,
    vision,
    members: members.length,
  }
}

async function read(dbPath) {
  let DatabaseSync
  try {
    ;({ DatabaseSync } = await import('node:sqlite'))
  } catch {
    return undefined
  }
  const { connectDb } = await import(new URL('db/index.js', VENDOR).href)
  const groupsModule = await import(new URL('services/model-groups.js', VENDOR).href)
  const adapter = openReadOnly(connectDb, DatabaseSync, dbPath)
  try {
    const groups = groupsModule.getModelGroups()
    const meta = new Map()
    for (const row of adapter
      .prepare(
        'SELECT id, size_label, rpm_limit, rpd_limit, tpm_limit, tpd_limit, context_window, supports_tools, supports_vision FROM models',
      )
      .all()) {
      meta.set(row.id, row)
    }
    const scores = new Map()
    let weights
    let strategy
    try {
      // The scoring pass the dashboard table renders. Wrapped because it reaches
      // much deeper into the router than the group query does, and losing it only
      // costs the numbers, never the list.
      const routerModule = await import(new URL('services/router.js', VENDOR).href)
      const result = routerModule.getRoutingScores()
      weights = result?.weights
      strategy = result?.strategy
      for (const score of result?.scores ?? []) scores.set(score.modelDbId, score)
    } catch {
      // Leave the axes out; `describeGroup` copes with an empty score map.
    }
    const rows = new Map()
    for (const group of groups) {
      const described = describeGroup(group, meta, scores)
      if (described !== undefined) rows.set(group.canonicalId, described)
    }
    if (rows.size === 0) return undefined
    return { rows, weights, strategy, computedAt: Date.now(), scored: scores.size }
  } finally {
    try {
      adapter.close()
    } catch {
      // Closing a handle we may never have opened is not worth raising.
    }
  }
}

/**
 * Rank map for the panel, keyed by the canonical id the catalogue uses.
 *
 * Returns `undefined` when the database cannot be read, so callers degrade to a
 * list without numbers instead of failing the whole status call. Failures are
 * not cached; a success is, briefly.
 *
 * Reads are serialised. The vendored `db` handle is a module-level singleton, so
 * two overlapping reads would have the second one swap the connection out from
 * under the first — the first then queries a closed handle and the ranking
 * silently drops for that turn. A probe poll landing on a click is enough to
 * trigger it, which makes "sometimes the numbers vanish" a real bug and not a
 * theoretical one. One chain, one read at a time.
 */
let chain = Promise.resolve()
let lastWarnAt = 0

export async function readRanking(dbPath, opts = {}) {
  if (typeof dbPath !== 'string' || dbPath === '' || !fs.existsSync(dbPath)) return undefined
  const ttl = opts.ttlMs ?? CACHE_TTL_MS
  const logger = opts.logger
  const unit = async () => {
    if (cache.value !== undefined && cache.dbPath === dbPath && Date.now() - cache.at < ttl) return cache.value
    let value
    try {
      value = await read(dbPath)
    } catch (error) {
      // A database mid-migration, or one this process may not open. The panel is
      // still useful without ranks, so this stays a missing feature rather than
      // an error — but the reason is logged, otherwise "ranks are gone" is
      // undiagnosable from the outside. Throttled: this runs on every poll.
      if (logger !== undefined && Date.now() - lastWarnAt > 60_000) {
        lastWarnAt = Date.now()
        logger.warn('[freellmapi] could not read the router database for ranking: %s', String(error?.message ?? error))
      }
      return undefined
    }
    if (value === undefined) return undefined
    cache = { at: Date.now(), dbPath, value }
    return value
  }
  const next = chain.then(unit, unit)
  // Keep the chain alive even when this unit rejects: a broken link would make
  // every later read wait on a promise that already settled.
  chain = next.catch(() => {})
  return next
}

/** One catalogue id's ranking, or `undefined` for a virtual/special row. */
export function rankOf(ranking, id) {
  if (ranking === undefined || ranking.rows === undefined) return undefined
  return ranking.rows.get(id)
}

/** The dashboard URL the ranks come from: the API base without its `/v1`. */
export function consoleUrlOf(baseURL) {
  if (typeof baseURL !== 'string') return undefined
  const trimmed = baseURL.trim().replace(/\/+$/, '')
  if (trimmed === '') return undefined
  const withoutVersion = trimmed.replace(/\/v\d+$/, '')
  return withoutVersion === '' ? undefined : withoutVersion
}
