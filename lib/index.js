/**
 * FreeLLMAPI for DSH — plugin entry (Host half).
 *
 * Two things live here, and they are separable on purpose:
 *
 * 1. A model provider route (`freellmapi`) that fronts the user's local
 *    FreeLLMAPI server, so every free model that router reaches becomes a normal
 *    DSH model instead of a hand-written patch block that goes stale.
 * 2. Management of that server process — start, stop, health, model list — so
 *    the router is a thing this app owns rather than a script the user remembers
 *    to run before opening the app.
 *
 * `llm` is the only hard requirement: a composition without an HTTP server still
 * serves models, it just has no panel. That is why the dashboard half runs in its
 * own `ctx.inject` fiber.
 *
 * @module lib/index
 */

import fs from 'node:fs'
import path from 'node:path'

import { FreeLlmApiAdapter, ROUTE } from './adapter.js'
import { CREDENTIAL_NAME, DATA_DIR, DEFAULTS, SettingsFile, resolveApiKey, resolveDshHome } from './store.js'
import { installationStatus, Supervisor } from './supervisor.js'
import { readUnifiedKey, runtimePaths } from './runtime.js'
import { PROBE_TTL_MS, clearProbeCache, probeBatch, probeUpdatedAt, readProbeCache, selectRows, verdictOf } from './probe.js'
import { consoleUrlOf, rankOf, readRanking } from './ranking.js'

export const name = 'freellmapi'

/** The model lane is the contract; everything else degrades. */
export const inject = ['llm']

const ROUTE_PREFIX = '/api/freellmapi/'
const MAX_BODY = 64 * 1024

export function apply(ctx, config) {
  const logger = ctx.logger ?? console
  const home = resolveDshHome()
  const dir = path.resolve(home, DATA_DIR)
  fs.mkdirSync(dir, { recursive: true })

  const settings = new SettingsFile(dir)
  // A patch-level config is the deployment's floor: an operator who ships a
  // baseURL in the bundle patch means it, and the panel edits from there on.
  if (config !== null && typeof config === 'object' && Object.keys(config).length > 0) {
    settings.save({ ...settings.get(), ...config })
  }

  let apiKey = undefined
  // Where the current key came from, so the panel can say "from the bundled
  // router" instead of the misleading "environment" for a key nobody exported.
  let keySource = 'missing'
  const refreshKey = async () => {
    // Precedence: an explicit key the operator stored/exported wins, because it
    // is the only one they can rotate deliberately. With none set, the router's
    // own database is authoritative — that is the key it just generated, and
    // asking the user to copy it out of the dashboard before first use would be
    // busywork the plugin can do itself.
    apiKey = await resolveApiKey(ctx)
    keySource = apiKey === undefined ? 'missing' : 'environment'
    if (apiKey === undefined) {
      apiKey = await readUnifiedKey(runtimePaths(dir).dbPath)
      if (apiKey !== undefined) keySource = 'bundled-router'
    }
    return apiKey
  }
  void refreshKey()

  // Bring the bundled router up for lanes that cannot start it themselves: the
  // adapter and the harness's model picker only issue requests. Returns quietly
  // when autostart is off — that setting means the user runs the router.
  //
  // `start()` also reports the key when the router is already up, which is the
  // case that matters on a warm start: reachability alone would leave the key
  // unread and turn every request into INVALID_CREDENTIAL.
  const ensureRouter = async () => {
    if (!settings.get().autoStart) return false
    await supervisor.start({ onKey })
    return true
  }

  const supervisor = new Supervisor({ stateDir: dir, settings: () => settings.get(), logger })
  // What the DSH model picker should offer. The router's `available` flag is a
  // database bit, not an answer: on a real install 54 rows claim to work while
  // only 22 produce a completion, and the rest are 404 (removed upstream), 429
  // (cooling) or 502. `selectRows` hides the ones a probe proved dead, and a
  // list the user checked themselves overrides everything.
  const offer = (rows) => selectRows(rows, { enabledModels: settings.get().enabledModels, probes: readProbeCache(dir) })
  const adapter = new FreeLlmApiAdapter({
    settings: () => ({ ...settings.get(), apiKey }),
    logger,
    ensureUp: ensureRouter,
    // The harness reads the picker off the adapter, so the narrowing has to be
    // handed to it there — a filter only the plugin applied itself was invisible.
    offer,
    resolveImage: undefined,
  })

  // Starting the router also hands back the key it bootstrapped, so the model
  // lane becomes usable the moment the server is up.
  const onKey = (key) => {
    if (apiKey === undefined) {
      apiKey = key
      keySource = 'bundled-router'
    }
  }
  const sourceOf = () => keySource

  const offeredRows = async () => {
    const all = await adapter.allModels(ROUTE)
    return { all, ...offer(all) }
  }

  // A probe pass is 20-60 seconds of real completions, one per model, so it runs
  // once per session after the router has been up a while — never in the
  // critical path of opening the picker, which would leave it spinning.
  let probing = undefined
  const probeCycle = () => {
    if (probing !== undefined) return probing
    probing = (async () => {
      if (!settings.get().probeModels) return { probed: 0, off: true }
      const key = await refreshKey()
      if (key === undefined || !(await supervisor.reachable())) return { probed: 0, down: true }
      const rows = (await adapter.allModels(ROUTE)).filter((row) => row.available !== false)
      const cache = readProbeCache(dir)
      const now = Date.now()
      const stale = (id) => cache[id] === undefined || now - cache[id].at >= PROBE_TTL_MS
      const todo = rows.filter((row) => stale(row.id)).map((row) => row.id)
      if (todo.length === 0) return { probed: 0, cached: rows.length }
      const before = offer(rows).rows.map((row) => row.id).join(',')
      await probeBatch({
        settings: () => ({ baseURL: settings.get().baseURL, apiKey }),
        ids: todo,
        dir,
        userAgent: await adapter.attribution(),
      })
      const after = offer(rows).rows.map((row) => row.id).join(',')
      // The harness caches a discovered catalogue, so a verdict that changes what
      // is offered has to be announced or the picker keeps showing the old list.
      if (before !== after) ctx.llm.emitAdaptersUpdated?.()
      return { probed: todo.length, changed: before !== after }
    })().finally(() => {
      probing = undefined
    })
    return probing
  }

  // One pass per session, armed a while after the router is expected to be up.
  // `probeCycle` itself dedupes, so the only job here is to not stack timers:
  // discovery and the panel both want fresh verdicts, and a second timer would
  // re-probe models the first pass just settled.
  let probeTimer = undefined
  const maybeProbe = (delayMs = 20_000) => {
    if (!settings.get().probeModels || probeTimer !== undefined) return
    probeTimer = setTimeout(() => {
      probeTimer = undefined
      void probeCycle().catch((error) => logger.warn?.(`dsh-freellmapi: probe failed: ${describe(error)}`))
    }, delayMs)
  }
  ctx.effect(() => () => clearTimeout(probeTimer), 'dsh-freellmapi: probe timer')

  // A stored credential or an edited `.env` must be visible to the next request
  // without restarting the app: the seam fires this when a value is saved.
  ctx.on?.('credentials/reference-updated', () => {
    void refreshKey()
  })

  const registration = ctx.llm.registerAdapter([ROUTE], adapter)
  ctx.effect(() => () => registration.dispose(), 'dsh-freellmapi: provider route')

  const settingsNamespace = ctx.fiber?.entry?.options?.id ?? name
  ctx.llm.registerConfigurableProviders?.([
    {
      provider: ROUTE,
      displayName: 'FreeLLMAPI',
      settingsNs: settingsNamespace,
      settingsPath: [],
      defaultBaseURL: DEFAULTS.baseURL,
      baseURLEnv: 'FREELLMAPI_BASE_URL',
    },
  ])

  // The picker reads this live list, so a provider added in the router appears in
  // DSH without touching a patch file.
  ctx.llm.registerModelDiscovery?.(settingsNamespace, async () => {
    // The picker calls the adapter directly, so this is the only place that can
    // bring the router up for it — and it must, or the first thing a user does
    // (open the model list) reports a dead endpoint instead of just working.
    await ensureRouter()
    if ((await refreshKey()) === undefined) return []
    // Opening the list is the moment a user cares which models answer, so arm a
    // pass. It runs after the response, never delaying this one.
    maybeProbe(5_000)
    try {
      const { rows } = await offeredRows()
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        contextWindow: row.contextWindow ?? 131_072,
        maxTokens: Math.min(settings.get().defaultMaxTokens, row.contextWindow ?? 131_072),
        inputModalities: row.inputModalities,
      }))
    } catch (error) {
      logger.warn?.(`dsh-freellmapi: model discovery failed: ${describe(error)}`)
      throw error
    }
  })

  ctx.llm.emitAdaptersUpdated?.()
  logger.info?.(`dsh-freellmapi: route "${ROUTE}" registered against ${settings.get().baseURL}`)

  // Cold start: the bundled router comes up with the app unless turned off.
  if (settings.get().autoStart) {
    void supervisor.start({ onKey }).catch((error) => {
      logger.warn?.(`dsh-freellmapi: autostart failed: ${describe(error)}`)
    })
    ctx.effect(
      () => () => {
        supervisor.stop()
      },
      'dsh-freellmapi: stop the autostarted router',
    )
  }

  registerTool(ctx, { settings, supervisor, adapter, refreshKey, offeredRows, dir })

  // The panel half runs in its own fiber so a composition without an HTTP server
  // cannot take the model lane down with it. `ctx.inject` pends until the service
  // exists, which is why reading `ctx.get('webServer')` at apply time is wrong.
  ctx.inject(['webServer'], (scoped) => {
    const server = scoped.webServer
    scoped.effect(
      () => server.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (req, res) => apiRoute(req, res, { ctx, settings, supervisor, adapter, refreshKey, logger, onKey, dir, sourceOf, maybeProbe, runProbe: probeCycle, isProbing: () => probing !== undefined }),
      }),
      'dsh-freellmapi: panel api',
    )
    logger.info?.(`dsh-freellmapi: panel API mounted at ${ROUTE_PREFIX}`)
  })
}

/**
 * One API surface for the panel: read state, change settings, drive the process.
 *
 * Everything that writes is POST and same-origin guarded; a read is a POST too,
 * because the guard is cheaper to keep in one place than to reason about twice.
 */
async function apiRoute(req, res, deps) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  if (!sameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: 'origin rejected' })
    return
  }
  try {
    const body = await readBody(req)
    const action = typeof body.action === 'string' ? body.action : 'status'
    sendJson(res, 200, { ok: true, ...(await run(action, body, deps)) })
  } catch (error) {
    sendJson(res, 400, { ok: false, error: describe(error) })
  }
}

async function run(action, body, deps) {
  const { ctx, settings, supervisor, adapter, refreshKey, logger, onKey, dir, sourceOf, maybeProbe, runProbe, isProbing } = deps
  switch (action) {
    case 'status':
      maybeProbe?.(2_000)
      return await statusOf({ ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing })
    case 'save': {
      const before = JSON.stringify(settings.get().enabledModels)
      adapter.invalidateCatalog()
      const saved = settings.save(body.patch ?? {})
      // The picker's list is derived from `enabledModels`, so a save that changed
      // it is only visible to DSH after the harness drops its cached catalogue.
      if (JSON.stringify(saved.enabledModels) !== before) ctx.llm.emitAdaptersUpdated?.()
      return { settings: saved, ...(await statusOf({ ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing })) }
    }
    case 'probe':
      // Deliberate: the panel button that re-asks, ignoring the schedule. The
      // cycle itself skips models probed within the TTL, so this is cheap unless
      // the caller passed `force`.
      if (body.force === true) clearProbeCache(dir)
      void runProbe().catch((error) => logger.warn?.(`dsh-freellmapi: probe failed: ${describe(error)}`))
      return { probeStarted: true, ...(await statusOf({ ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing })) }
    case 'start':
      adapter.invalidateCatalog()
      maybeProbe?.(10_000)
      return { ...(await supervisor.start({ onKey })), ...(await statusOf({ ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing })) }
    case 'stop':
      adapter.invalidateCatalog()
      return { ...supervisor.stop(), ...(await statusOf({ ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing })) }
    case 'set-key': {
      // Writing through the seam is the only way the key reaches the harness.
      // A composition without it must say so instead of throwing a TypeError.
      const credentials = ctx.get('credentials')
      if (credentials === undefined) {
        throw new Error('this composition has no credential service; set FREELLMAPI_API_KEY in the environment instead')
      }
      const value = typeof body.key === 'string' ? body.key.trim() : ''
      if (value === '') {
        await credentials.unset(CREDENTIAL_NAME)
        adapter.invalidateCatalog()
        await refreshKey()
        return { keySet: false }
      }
      await credentials.set(CREDENTIAL_NAME, value)
      adapter.invalidateCatalog()
      await refreshKey()
      return { keySet: true }
    }
    case 'install':
      return installationStatus(dir)
    case 'models': {
      if ((await refreshKey()) === undefined) throw new Error('no unified key is configured')
      adapter.invalidateCatalog()
      // The same narrowing the picker sees, so "what models can I use" has one
      // answer whether it is asked from a panel, the picker, or a tool call.
      const { rows } = await offeredRows()
      return { models: rows }
    }
    default:
      throw new Error(`unknown action: ${action}`)
  }
}

async function statusOf(deps) {
  const { ctx, settings, supervisor, adapter, refreshKey, dir, sourceOf, isProbing } = deps
  const key = await refreshKey()
  const current = settings.get()
  const reachable = await supervisor.reachable()
  let catalogue
  let catalogueError
  if (reachable && key !== undefined) {
    try {
      // The panel shows every row the router lists — a model the router or a
      // probe says is dead is still worth displaying, because the user may know
      // better and switch it on. `offered` is what the picker really gets, and
      // it is the same `selectRows` the adapter applies, so the number on the
      // panel and the list in DSH cannot drift apart.
      const rows = await adapter.allModels(ROUTE)
      const probes = readProbeCache(dir)
      const picked = selectRows(rows, { enabledModels: current.enabledModels, probes })
      const offeredIds = new Set(picked.rows.map((row) => row.id))
      // The router scores its own catalogue in the database (reliability, speed,
      // intelligence, one combined number). That is what the bundled dashboard's
      // table shows, and the panel shows the same numbers rather than a second
      // opinion — see lib/ranking.js for why they are read from the router's own
      // code path. An unreadable database only costs the numbers.
      const ranking = await readRanking(runtimePaths(dir).dbPath)
      catalogue = {
        total: rows.length,
        claimed: rows.filter((row) => row.available).length,
        offered: offeredIds.size,
        dead: picked.dead,
        usingOwnList: current.enabledModels.length > 0,
        probedAt: probeUpdatedAt(dir),
        ranked: ranking === undefined ? 0 : ranking.rows.size,
        rankingError: ranking === undefined ? 'the router database could not be read' : undefined,
        consoleUrl: consoleUrlOf(current.baseURL),
        models: rows.map((row) => ({
          id: row.id,
          name: row.name,
          contextWindow: row.contextWindow,
          available: row.available,
          note: row.unavailableReason,
          offered: offeredIds.has(row.id),
          probe: verdictOf(probes, row.id),
          // `undefined` for the virtual rows (auto, fusion, the Claude slots):
          // they are routes, not models, so they have nothing to score.
          rank: rankOf(ranking, row.id),
        })),
      }
    } catch (error) {
      catalogueError = describe(error)
    }
  }
  // A composition without the credential seam still resolves the key from the
  // environment, so the answer must come from the resolved value first and only
  // then from `describe()` (which knows the storage layer, not the fallback).
  let keyState = sourceOf()
  if (key !== undefined && keyState === 'environment') {
    try {
      const seam = ctx.get('credentials')
      const described = await seam?.describe?.(CREDENTIAL_NAME)
      // `describe()` reports the storage layer only: it answers configured=true
      // with source="missing" for a key that came from the environment, so a
      // "missing" source must not overwrite the source we already know.
      if (described?.configured === true && typeof described.source === 'string' && described.source !== 'missing') {
        keyState = described.source
      }
    } catch {
      // A composition without the seam reports the local view only.
    }
  }
  return {
    settings: current,
    server: { ...supervisor.status(), reachable },
    install: installationStatus(dir),
    key: { configured: key !== undefined, source: keyState, name: CREDENTIAL_NAME },
    // A probe pass runs for tens of seconds in the background. Without this the
    // panel's button looks dead: it returns immediately, and the numbers only
    // move once the pass lands, so the user cannot tell a start from a no-op.
    probingNow: isProbing === undefined ? false : isProbing(),
    catalogue,
    catalogueError,
  }
}

/**
 * The agent-facing half: one tool, because a person asking "is the router up"
 * during a session should get an answer without opening a panel.
 */
function registerTool(ctx, { settings, supervisor, refreshKey, offeredRows, dir }) {
  // `ctx.tools` would throw: only `llm` is injected. `ctx.get` asks without
  // claiming a dependency, which is what an optional convenience wants.
  const tools = ctx.get('tools')
  if (tools === undefined) return
  ctx.effect(
    () => tools.register({
      name: 'freellmapi',
      description:
        'Inspect or control the local FreeLLMAPI router that backs the `freellmapi` model provider: report whether it is listening, list the models it can currently reach, and start or stop the server process.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['status', 'models', 'start', 'stop'],
            description: 'status reports the server and catalogue; models lists reachable models; start and stop drive the process.',
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (args, value) => [{ type: 'text', text: renderToolResult(args, value) }],
      },
      timeoutMs: 60_000,
      isConcurrencySafe: () => false,
      presentCall: (args) => ({ card: 'generic', title: 'FreeLLMAPI', kind: 'status', rawInput: args }),
      async execute(args) {
        const action = typeof args?.action === 'string' ? args.action : 'status'
        if (action === 'start') return await supervisor.start()
        if (action === 'stop') return supervisor.stop()
        const reachable = await supervisor.reachable()
        if (action === 'models') {
          if ((await refreshKey()) === undefined) throw new Error('no unified key is configured')
          const { rows } = await offeredRows()
          return { models: rows.map((row) => row.id) }
        }
        // Counts, not a re-probe: a full pass outlasts this tool's timeout by
        // minutes, and the verdicts it would produce are already on disk.
        const probes = readProbeCache(dir)
        const verdicts = Object.values(probes)
        return {
          ...supervisor.status(),
          reachable,
          baseURL: settings.get().baseURL,
          probedAt: probeUpdatedAt(dir),
          answered: verdicts.filter((entry) => entry?.ok === true).length,
          dead: verdicts.filter((entry) => entry?.ok === false).length,
        }
      },
    }),
    'dsh-freellmapi: agent tool',
  )
}

function renderToolResult(args, value) {
  const action = args?.action ?? 'status'
  if (action === 'models') {
    const models = Array.isArray(value?.models) ? value.models : []
    return models.length === 0
      ? 'FreeLLMAPI offers no reachable models right now.'
      : `FreeLLMAPI offers ${models.length} model(s): ${models.slice(0, 40).join(', ')}${models.length > 40 ? ', …' : ''}`
  }
  if (action === 'start') return value?.started === true ? `FreeLLMAPI started (pid ${value.pid}).` : 'FreeLLMAPI was already running.'
  if (action === 'stop') return value?.stopped === true ? `FreeLLMAPI stopped (pid ${value.pid}).` : 'No server was started by this plugin; stop it where it was launched.'
  const lines = [
    `FreeLLMAPI at ${value?.baseURL ?? ''}: ${value?.reachable === true ? 'listening' : 'not reachable'}`,
  ]
  if (value?.pid !== null && value?.pid !== undefined) lines.push(`managed pid ${value.pid}`)
  if (Array.isArray(value?.answered) || typeof value?.answered === 'number') {
    lines.push(`${value.answered} model(s) answered a real request, ${value.dead} did not (probe ${agoLabel(value?.probedAt)})`)
  }
  if (typeof value?.lastError === 'string' && value.lastError !== '') lines.push(value.lastError)
  return lines.join('\n')
}

function agoLabel(at) {
  if (typeof at !== 'number' || at === 0) return 'never'
  const mins = Math.round((Date.now() - at) / 60_000)
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)} h ago`
}

function sameOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  return origin === undefined || host === undefined || origin === `http://${host}` || origin === `https://${host}`
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    let tooLarge = false
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        rejectBody(new Error('request body too large'))
        return
      }
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolveBody({})
        return
      }
      try {
        const parsed = JSON.parse(text)
        resolveBody(parsed !== null && typeof parsed === 'object' ? parsed : {})
      } catch {
        rejectBody(new Error('request body must be JSON'))
      }
    })
    req.on('error', rejectBody)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function describe(error) {
  return error instanceof Error ? error.message : String(error)
}
