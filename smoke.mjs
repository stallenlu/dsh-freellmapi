/**
 * The checks that would catch a break, in one runnable file.
 *
 * No test framework: this package ships to a host that runs it with plain Node,
 * and the value here is the assertions themselves, not a runner. Offline checks
 * cover the wire translation, which is where a silent regression is expensive —
 * a wrong usage split or an unclosed block corrupts every turn after it. The
 * live check only runs when a router answers, and says so when it does not.
 *
 * Run: node smoke.mjs [--live]
 */

import assert from 'node:assert/strict'
import fs, { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { toChatMessages, toToolDefs, repairToolPairing } from './lib/chat.js'
import { BlockWriter, CODE, classifyStatus, finishReason, mapUsage, readChatStream } from './lib/stream.js'
import { normalize } from './lib/store.js'

const failures = []
const pending = []
function check(label, body) {
  const record = (error) => {
    failures.push(`${label}: ${error.message}`)
    console.log(`FAIL ${label}: ${error.message}`)
  }
  let result
  try {
    result = body()
  } catch (error) {
    record(error)
    return
  }
  // An async body used to print `ok` on its way out and throw afterwards, so a
  // broken filter could pass this suite for a whole release. Await them all.
  if (result instanceof Promise) pending.push(result.then(() => console.log(`ok   ${label}`), record))
  else console.log(`ok   ${label}`)
}

function sse(payloads) {
  const text = payloads.map((item) => `data: ${typeof item === 'string' ? item : JSON.stringify(item)}\n\n`).join('')
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

// --- wire translation -------------------------------------------------------

check('usage is split so cached and reasoning tokens are not double counted', () => {
  const usage = mapUsage({
    prompt_tokens: 100,
    completion_tokens: 40,
    total_tokens: 140,
    prompt_tokens_details: { cached_tokens: 60 },
    completion_tokens_details: { reasoning_tokens: 25 },
  })
  assert.equal(usage.inputTokens, 40, 'prompt tokens include the cached part; input must not')
  assert.equal(usage.outputTokens, 40)
  assert.equal(usage.cacheReadTokens, 60)
  assert.equal(usage.reasoningTokens, 25, 'reasoning is a subset of output, not an addition')
  assert.equal(usage.totalTokens, 140)
})

check('a finish reason maps to the harness vocabulary', () => {
  assert.deepEqual(finishReason('tool_calls'), { kind: 'tool-calls' })
  assert.deepEqual(finishReason('length'), { kind: 'max-tokens' })
  assert.deepEqual(finishReason('stop'), { kind: 'stop' })
  assert.deepEqual(finishReason(undefined), { kind: 'stop' })
})

check('a status maps to a retryable code', () => {
  assert.equal(classifyStatus(429, ''), CODE.rateLimit)
  assert.equal(classifyStatus(401, ''), CODE.credential)
  assert.equal(classifyStatus(500, ''), CODE.server)
  assert.equal(classifyStatus(400, 'context length exceeded'), CODE.contextWindow)
})

check('blocks open once, keep their index, and close in order', () => {
  const emitted = []
  const writer = new BlockWriter((chunk) => emitted.push(chunk))
  writer.text('a')
  writer.text('b')
  writer.closeAll()
  const starts = emitted.filter((chunk) => chunk.type === 'block-start')
  assert.equal(starts.length, 1, 'one text stream is one block')
  assert.equal(starts[0].index, 0)
  const text = emitted.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text).join('')
  assert.equal(text, 'ab')
  assert.equal(emitted.at(-1).type, 'block-end')
})

check('a stream yields deltas, then usage, then finish', async () => {
  const response = sse([
    { choices: [{ index: 0, delta: { role: 'assistant', reasoning: 'thinking' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { content: 'hel' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: { content: 'lo' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
    '[DONE]',
  ])
  const chunks = []
  for await (const chunk of readChatStream(response, new AbortController().signal)) chunks.push(chunk)
  const kinds = chunks.map((chunk) => chunk.type)
  assert.equal(kinds.filter((kind) => kind === 'finish').length, 1)
  assert.equal(kinds.indexOf('usage') < kinds.indexOf('finish'), true, 'usage must precede finish')
  assert.equal(kinds.at(-1), 'finish', 'nothing may follow finish')
  const text = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text).join('')
  assert.equal(text, 'hello')
  const reasoning = chunks.filter((chunk) => chunk.type === 'reasoning-delta').map((chunk) => chunk.text).join('')
  assert.equal(reasoning, 'thinking')
  assert.deepEqual(chunks.find((chunk) => chunk.type === 'finish').reason, { kind: 'stop' })
})

check('tool arguments arrive as one string and close as a tool-call block', async () => {
  const response = sse([
    {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get_weather', arguments: '{"city":' } }],
          },
          finish_reason: null,
        },
      ],
    },
    {
      choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }] }, finish_reason: null }],
    },
    { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    '[DONE]',
  ])
  const chunks = []
  for await (const chunk of readChatStream(response, new AbortController().signal)) chunks.push(chunk)
  const end = chunks.find((chunk) => chunk.type === 'block-end')
  assert.equal(end.block.type, 'tool-call')
  assert.equal(end.block.name, 'get_weather')
  assert.equal(end.block.arguments, '{"city":"Paris"}', 'fragments must be concatenated, not re-parsed')
  assert.deepEqual(chunks.find((chunk) => chunk.type === 'finish').reason, { kind: 'tool-calls' })
})

check('an empty completion is an error, not a silent success', async () => {
  const response = sse([
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    '[DONE]',
  ])
  const chunks = []
  for await (const chunk of readChatStream(response, new AbortController().signal)) chunks.push(chunk)
  const finish = chunks.find((chunk) => chunk.type === 'finish')
  assert.equal(finish.reason.kind, 'error')
  assert.equal(finish.reason.failure.code, CODE.empty)
})

// --- harness projection -----------------------------------------------------

check('an assistant tool call and its answer project to the chat wire', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'weather?' }] },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'checking' },
        { type: 'tool-call', id: 'call_1', name: 'get_weather', arguments: '{"city":"Paris"}' },
      ],
    },
    {
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'call_1', content: [{ type: 'text', text: 'sunny' }] }],
    },
  ]
  const out = toChatMessages(messages, undefined, [])
  assert.equal(out[0].role, 'user')
  assert.equal(out[1].role, 'assistant')
  assert.equal(out[1].tool_calls[0].function.name, 'get_weather')
  assert.equal(out[1].tool_calls[0].function.arguments, '{"city":"Paris"}')
  assert.equal(out[2].role, 'tool')
  assert.equal(out[2].tool_call_id, 'call_1')
  assert.equal(out[2].content, 'sunny')
})

check('an unanswered tool call is dropped rather than sent upstream to fail', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: 'call_9', name: 'x', arguments: '{}' }] },
  ]
  const repaired = repairToolPairing(messages)
  const flat = JSON.stringify(repaired)
  assert.equal(flat.includes('call_9'), false, 'an orphan call poisons every later turn with a 400')
})

check('tool definitions pass through either spelling', () => {
  const defs = toToolDefs([
    { name: 'a', description: 'A', parameters: { type: 'object', properties: {} } },
    { type: 'function', function: { name: 'b', description: 'B', parameters: { type: 'object', properties: {} } } },
    { description: 'no name' },
  ])
  assert.equal(defs.length, 2)
  assert.equal(defs[0].function.name, 'a')
  assert.equal(defs[1].function.name, 'b')
})

// --- settings ---------------------------------------------------------------

check('settings refuse an address that cannot work', () => {
  assert.equal(normalize({ baseURL: 'http://127.0.0.1:3001/v1/' }).baseURL, 'http://127.0.0.1:3001/v1')
  assert.throws(() => normalize({ baseURL: 'ftp://example.com' }), /http/i)
  assert.equal(normalize({}).defaultMaxTokens, 8192)
  assert.equal(normalize({ requestTimeoutMs: 'abc' }).requestTimeoutMs, 300000)
})

// --- self-contained runtime -------------------------------------------------

const runtime = await import('./lib/runtime.js')
const supervisor = await import('./lib/supervisor.js')
const panel = await import('./lib/index.js')

check('the bundled router is present in this package', () => {
  const stateDir = path.join(os.tmpdir(), `dflm-smoke-${process.pid}`)
  const paths = runtime.runtimePaths(stateDir)
  assert.ok(paths.entry.endsWith(path.join('vendor', 'server-dist', 'index.js')), paths.entry)
  assert.ok(paths.clientDist.endsWith(path.join('vendor', 'client-dist')), paths.clientDist)
  // Paths alone prove nothing: the template strings could point at a folder
  // that was never copied into the package.
  assert.equal(supervisor.installationStatus(stateDir).installed, true, 'vendor/ is missing from the package')
})

check('the runtime keeps its key and database beside the state directory', () => {
  const stateDir = path.join(os.tmpdir(), `dflm-smoke-${process.pid}`)
  const paths = runtime.runtimePaths(stateDir)
  assert.ok(paths.dbPath.startsWith(paths.dataDir), 'the database must live under the state directory')
  assert.ok(paths.envPath.startsWith(stateDir), 'the encryption key must not escape the state directory')
  runtime.ensureRuntime(paths)
  const written = readFileSync(paths.envPath, 'utf8')
  // A regenerated ENCRYPTION_KEY silently makes every stored provider key
  // undecryptable, so the file is written once and only once.
  runtime.ensureRuntime(paths)
  assert.equal(readFileSync(paths.envPath, 'utf8'), written, 'the encryption key was rewritten')
  assert.match(written, /^ENCRYPTION_KEY=[0-9a-f]{64}$/m)
})

check('the child environment points the server at the bundled assets', () => {
  const stateDir = path.join(os.tmpdir(), `dflm-smoke-${process.pid}`)
  const paths = runtime.runtimePaths(stateDir)
  const env = runtime.childEnv(paths, { baseURL: 'http://127.0.0.1:3001/v1' })
  assert.equal(env.PORT, '3001')
  assert.equal(env.HOST, '127.0.0.1')
  assert.equal(env.FREEAPI_ENV_PATH, paths.envPath)
  assert.equal(env.FREEAPI_DB_PATH, paths.dbPath)
  assert.equal(env.CLIENT_DIST, paths.clientDist)
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1', 'the host binary must run as Node, not as the desktop app')
  assert.equal('NO_PROXY' in env, false, 'inherit must leave the OS proxy choice alone')
  assert.equal(runtime.childEnv(paths, { baseURL: 'http://127.0.0.1:3001/v1', proxy: 'direct' }).NO_PROXY, '*')
})

check('a settings file starts the bundled router by default', async () => {
  const { DEFAULTS } = await import('./lib/store.js')
  assert.equal(DEFAULTS.autoStart, true)
  assert.equal('startCommand' in DEFAULTS, false, 'a self-contained install needs no external command')
})

check('a port conflict is reported as one, not as a bare exit code', async () => {
  const { describeExit } = await import('./lib/supervisor.js')
  const says = describeExit('the bundled server exited with code 1', [
    '[server] Failed to start:',
    '  listen EADDRINUSE: address already in use 127.0.0.1:3001',
  ])
  assert.match(says, /already taken/, 'the user must be told the port is occupied')
  assert.doesNotMatch(says, /EADDRINUSE/, 'the raw Node error is noise to a panel reader')
  // Any other reason keeps the child's own words, since we cannot name it for them.
  assert.match(describeExit('the bundled server exited with code 1', ['Error: boom']), /boom/)
})

check('a lane with no key asks the router to start instead of failing', async () => {
  const { FreeLlmApiAdapter } = await import('./lib/adapter.js')
  let started = 0
  const adapter = new FreeLlmApiAdapter({
    // The key only exists after the start, exactly like a first-ever boot.
    settings: () => ({ baseURL: 'http://127.0.0.1:3001/v1', apiKey: started === 0 ? undefined : 'k', defaultMaxTokens: 8192 }),
    logger: {},
    ensureUp: async () => {
      started += 1
      return true
    },
  })
  adapter.readCatalog = async () => [{ id: 'auto', name: 'auto', contextWindow: 128_000 }]
  const rows = await adapter.listModels('freellmapi')
  assert.equal(started, 1, 'the picker cannot start the router itself, so the adapter must')
  assert.equal(rows.length, 1)
})

check('concurrent lanes share one start', async () => {
  const { Supervisor } = await import('./lib/supervisor.js')
  let spawns = 0
  const supervisor = new Supervisor({ stateDir: 'unused', settings: () => ({}), logger: {} })
  supervisor.reachable = async () => false
  supervisor.startUnshared = async () => {
    spawns += 1
    await new Promise((r) => setTimeout(r, 20))
    return { started: true }
  }
  await Promise.all([supervisor.start(), supervisor.start(), supervisor.start()])
  assert.equal(spawns, 1, 'two lanes racing a cold router must not both spawn')
})

check('the picker shows the window a request will really get', async () => {
  const { FreeLlmApiAdapter } = await import('./lib/adapter.js')
  const adapter = new FreeLlmApiAdapter({ settings: () => ({ baseURL: 'http://x/v1', apiKey: 'k', defaultMaxTokens: 8192 }), logger: {} })
  adapter.readCatalog = async () => [
    { id: 'qwen3.8-27b', name: 'q', contextWindow: 262_000 },
    // A slot's window belongs to the model behind it, so it must not be advertised.
    { id: 'claude-sonnet-4-5', name: 'c', contextWindow: 128_000 },
  ]
  const rows = await adapter.listModels('freellmapi')
  const real = await adapter.resolveModel('freellmapi', 'qwen3.8-27b')
  assert.equal(rows[0].contextWindow, real.context.contextWindow)
  assert.equal(rows[1].contextWindow, 131_072, 'a slot falls back to the safe default in both paths')
})

check('a claimed-available flag alone does not decide what the picker offers', async () => {
  const { selectRows, PROBE_TTL_MS } = await import('./lib/probe.js')
  const now = Date.now()
  const rows = [
    { id: 'live', available: true },
    { id: 'gone', available: true },
    { id: 'cooling', available: true },
    { id: 'nokey', available: false },
  ]
  const probes = {
    gone: { ok: false, status: 404, at: now - 60_000 },
    cooling: { ok: false, status: 429, at: now - 60_000 },
  }
  const picked = selectRows(rows, { probes, now })
  assert.deepEqual(picked.rows.map((r) => r.id), ['live', 'cooling'], 'a 404 is removed, a rate limit is not')
  assert.equal(picked.dead, 1)
  // An old verdict is a guess again: cooldowns and upstreams move.
  const stale = selectRows(rows, { probes: { gone: { ok: false, status: 404, at: now - PROBE_TTL_MS - 1 } }, now })
  assert.deepEqual(stale.rows.map((r) => r.id), ['live', 'gone', 'cooling'])
  // The user's own list wins outright, dead or not.
  const own = selectRows(rows, { enabledModels: ['nokey'], probes, now })
  assert.deepEqual(own.rows.map((r) => r.id), ['nokey'], 'a checked model is offered even when both signals say no')
})

check('the host path is the one that gets narrowed', async () => {
  const { FreeLlmApiAdapter } = await import('./lib/adapter.js')
  // `LlmService.listModels()` calls the registered ADAPTER, not the discovery
  // callback, so filtering only in the callback changes nothing in the picker.
  const adapter = new FreeLlmApiAdapter({
    settings: () => ({ baseURL: 'http://x/v1', apiKey: 'k', defaultMaxTokens: 8192 }),
    logger: {},
    offer: (rows) => ({ rows: rows.filter((r) => r.id !== 'gone'), dead: 1, claimed: rows.length }),
  })
  adapter.readCatalog = async () => [
    { id: 'live', name: 'l', contextWindow: 128_000, available: true },
    { id: 'gone', name: 'g', contextWindow: 128_000, available: true },
  ]
  const offered = await adapter.listModels('freellmapi')
  assert.deepEqual(offered.map((r) => r.id), ['live'], 'the picker only sees what offer() keeps')
  const every = await adapter.allModels('freellmapi')
  assert.deepEqual(every.map((r) => r.id), ['live', 'gone'], 'the panel still lists what was dropped, to re-enable it')
  // A dropped id must stay usable when typed by hand — the router may know better.
  const resolved = await adapter.resolveModel('freellmapi', 'gone')
  assert.equal(resolved.id, 'gone')
})

check('the enabled list survives a save round trip', async () => {
  const { normalize, DEFAULTS } = await import('./lib/store.js')
  assert.deepEqual(DEFAULTS.enabledModels, [], 'the default is "follow the probes", not a fixed list')
  const saved = normalize({ enabledModels: ['b', 'a', 'b', ' c ', 42] })
  assert.deepEqual(saved.enabledModels, ['a', 'b', 'c'], 'sorted and deduplicated so a re-save is not dirty')
  assert.equal(normalize({}).probeModels, true)
  assert.equal(normalize({ probeModels: false }).probeModels, false)
})

check('panel cards are mounted as components, not called inline', () => {
  // React hooks are per-component: calling StatusCard({...}) inline appends
  // its hooks to the CALLER's list, so a tab switch changes the hook count and
  // React throws — the whole panel renders blank. Every `X({ t, state, load })`
  // in client.js must therefore be a `function X` declaration, never a call.
  const src = readFileSync('./lib/client.js', 'utf8')
  const re = /(\S+ )?(\b(?:StatusCard|SettingsCard|ModelList)\(\{ t, state, load \}\))/g
  let m
  while ((m = re.exec(src)) !== null) {
    assert.equal(m[1], 'function ', `inline component call at offset ${m.index} — wrap it in h()`)
  }
})

check('the panel offers an entry-visibility choice that gates the slots', () => {
  // A slot cannot be registered conditionally, so the placement preference works
  // by mounting and tearing the injection down. If someone folds the inject()
  // calls back into bare ctx.slots.inject, the setting becomes a no-op that
  // still saves — silently. Assert the wiring instead of trusting it.
  const src = readFileSync('./lib/client.js', 'utf8')
  assert.match(src, /makePref\('dflm\.placement'/, 'placement pref missing')
  assert.match(src, /bindWhile\(\s*\(\) => placement\.get\(\) !== 'sidebar'/, 'plugin page entry not gated')
  assert.match(src, /bindWhile\(\s*\(\) => placement\.get\(\) !== 'settings'/, 'sidebar entry not gated')
  // The panel route is NOT gated: a view another part of the app can hold open
  // must not disappear because its icon was hidden. Only the icon is. A bare
  // inject re-registers on every HMR activation, so it still needs a ctx.effect
  // owner that tears the old panel down.
  assert.match(src, /ctx\.slots\.inject\('main'/, 'the main panel must still be injected')
  assert.match(
    src,
    /ctx\.effect\(\s*\(\) => ctx\.slots\.inject\('main'[\s\S]*?'dsh-freellmapi: main panel'/,
    'the main panel injection must be owned by a ctx.effect with a disposer',
  )
  // and every card still mounts through h(), for the reason above
  assert.doesNotMatch(src, /[^n] (?:StatusCard|SettingsCard|ModelList|Ranking)\(\{ t, state, load \}\)/, 'inline component call')
})

check('the list can be sorted and bulk-ticked without losing the filter scope', () => {
  // 287 rows is too many to tick one by one, so the panel offers sort keys and
  // select-all / clear-shown. Two things break silently here: the bulk buttons
  // must act on the LISTED rows (that is what makes "search qwen, select all"
  // work), and the status sort must rank on the probe verdict, not the router's
  // own flag — the flag is the number this panel exists to question.
  const src = readFileSync('./lib/client.js', 'utf8')
  assert.match(src, /usePersistent\('dflm\.sort', 'default'\)/, 'sort choice not persisted')
  for (const key of ['default', 'name', 'context', 'status']) {
    assert.ok(src.includes(`h('option', { value: '${key}' }`), `sort option ${key} missing`)
  }
  assert.match(src, /const selectShown = \(\) => setDraft\(\[\.\.\.new Set\(\[\.\.\.selected, \.\.\.shownIds\]\)\]\)/, 'select all must use the listed ids')
  assert.match(src, /setDraft\(selected\.filter\(\(id\) => !gone\.has\(id\)\)\)/, 'clear shown must only drop the listed ids')
  // The bulk row leads with "tick usable", and usable means exactly what the
  // 实测可用 tag says — a probe that answered. Including `offered` here made
  // the button keep dead rows in your own list, which is what the user hit.
  assert.match(src, /const usableIds = useMemo\(/, 'usable rows must be computed from the listed rows')
  assert.match(src, /shown\.filter\(\(row\) => row\.probe && row\.probe\.probed === true && row\.probe\.ok === true\)/, 'usable means a probe answered, nothing else')
  // It REPLACES the listed rows, not unions with them: pressing it after 全选
  // must drop the dead ones, or the user has to clear first every time.
  assert.match(src, /setDraft\(\[\.\.\.new Set\(\[\.\.\.selected\.filter\(\(id\) => !listed\.has\(id\)\), \.\.\.usableIds\]\)\]\)/, 'tick usable must replace the listed rows')
  assert.ok(src.includes("t('selectUsable', { n: usableIds.length })"), 'the usable button must show how many it ticks')
  assert.match(src, /if \(probe\.transient !== true\) return 2/, 'status rank must not treat a 429 as dead')
  assert.doesNotMatch(src, /statusRank[\s\S]{0,240}row\.available/, 'status rank must ignore the router flag')
  // Every sort mode leads with the rows the picker actually offers: a sort by
  // name that buries the working models under 287 dead ones helps nobody.
  for (const key of ['name', 'context', 'status']) {
    assert.ok(
      src.includes(`if (sortKey === '${key}') return [...list].sort((a, b) => Number(b.offered) - Number(a.offered) ||`),
      `sort ${key} must put offered rows first`,
    )
  }
  // appearance:none kills the native arrow, and the pill has no border, so the
  // select rendered as plain text and the user reported the sort feature was
  // missing. It has to draw its own affordance.
  assert.match(src, /\.dflm-cfg-select \{[^}]*background-image: url\("data:image\/svg\+xml/, 'the select must draw a dropdown arrow')
  assert.match(src, /\.dflm-cfg-select \{[^}]*padding: 0 28px 0 14px/, 'the arrow needs room that text cannot overlap')
  // The control sits in the same row as .dflm-btn buttons; a different height
  // or radius next to them reads as a misfit (user: 排序按钮的配置不协调).
  assert.match(src, /\.dflm-cfg-select \{[^}]*height: 32px[^}]*border-radius: 16px/, 'the select must match the button geometry')
})

check('the package ships an icon DSH can actually render', () => {
  // DSH reads a package-root `icon` (or the ./icon export), and `npm pack`
  // silently drops anything not listed in `files` — v1.0.4 shipped a tarball
  // whose index.js imported a module that was not in it. Check all three.
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
  assert.equal(pkg.icon, './icon.svg', 'package.json must declare the icon')
  assert.equal(pkg.exports['./icon'], './icon.svg', 'the ./icon export must resolve')
  assert.ok(pkg.files.includes('icon.svg'), 'npm pack would drop the icon')
  const svg = readFileSync('./icon.svg', 'utf8')
  assert.ok(svg.length <= 256 * 1024, 'DSH rejects icons over 256 KiB')
  assert.match(svg, /^<svg[^>]*viewBox="0 0 24 24"/, 'the SVG needs its viewBox')
  assert.match(svg, /stroke="currentColor"/, 'the icon must follow the theme')
  assert.ok((svg.match(/<circle|<path/g) || []).length >= 6, 'the icon must have visible geometry')
  // The sidebar draws its own copy; keeping the two in sync is a real regression
  // risk, so assert the same motif and both currentColor + size passthrough.
  const client = readFileSync('./lib/client.js', 'utf8')
  assert.match(client, /function PanelIcon\(\{ size \}\)/, 'the sidebar icon must take the host size')
  assert.match(client, /cx: 4\.6, cy: 12, r: 2\.1/, 'sidebar icon must use the router motif')
  assert.match(client, /stroke: 'currentColor'/, 'sidebar icon must follow the theme')
})

// --- ranking ----------------------------------------------------------------

check('the ranking reads the router’s own scores, not a second opinion', async () => {
  const { rankOf, consoleUrlOf, readRanking } = await import('./lib/ranking.js')
  // The console link is derived from the API base; a wrong strip sends the
  // button to a 404 in the browser.
  assert.equal(consoleUrlOf('http://127.0.0.1:3001/v1'), 'http://127.0.0.1:3001')
  assert.equal(consoleUrlOf('http://127.0.0.1:3001/v1/'), 'http://127.0.0.1:3001')
  assert.equal(consoleUrlOf('http://127.0.0.1:3001'), 'http://127.0.0.1:3001')
  assert.equal(consoleUrlOf(''), undefined)
  // A missing database is a missing feature, not a crash: the panel has to keep
  // listing models when the router has never been started.
  const missing = await readRanking(path.join(os.tmpdir(), 'dsh-freellmapi-no-such-freeapi.db'))
  assert.equal(missing, undefined)
  assert.equal(rankOf(missing, 'auto'), undefined)
  // The numbers must come from the vendored router. A hand-rolled join misses
  // two thirds of the catalogue, because /v1/models is keyed by group slug, not
  // by models.model_id — so assert the source of truth, not a copy of it.
  const src = readFileSync('./lib/ranking.js', 'utf8')
  assert.match(src, /services\/model-groups\.js/, 'canonical ids must come from the router')
  assert.match(src, /getModelGroups\(\)/, 'canonical ids must come from the router')
  assert.match(src, /services\/router\.js/, 'the score must be the dashboard’s own pass')
  assert.match(src, /getRoutingScores\(\)/, 'the score must be the dashboard’s own pass')
  // Read-only, and without the side effects a status poll must not have:
  // connectDb on a real path sets WAL and runs icacls on the live database.
  assert.match(src, /new DatabaseSync\(dbPath, \{ readOnly: true \}\)/, 'the database must be opened read-only')
  assert.match(src, /connectDb\(':memory:'/, ':memory: is what skips WAL and the ACL rewrite')
  // A thrown status call would blank the whole panel; the ranking is optional.
  assert.match(src, /return undefined/, 'an unreadable database must degrade, not throw')
})

check('the panel exposes the ranking tab and a way to the full console', () => {
  const src = readFileSync('./lib/client.js', 'utf8')
  assert.match(src, /const TABS = \['status', 'ranking', 'models', 'settings'\]/, 'the ranking tab must be reachable')
  assert.match(src, /tab === 'ranking' \? h\(Ranking, /, 'the ranking tab must mount its component')
  // The panel is a viewer; provider keys and routing policy stay in the :3001
  // dashboard, so the door has to exist in both the tab and the status card.
  assert.match(src, /href: catalogue\.consoleUrl/, 'the status card must link to the console')
  assert.match(src, /href: consoleUrl/, 'the ranking tab must link to the console')
  assert.match(src, /target: '_blank'/, 'the console must open in a new tab')
  assert.match(src, /rel: 'noreferrer noopener'/, 'the console link must not leak the opener')
  // Three axes, three colours: a translated label must never pick the bar colour.
  assert.match(src, /function RankAxis\(\{ kind, value, label \}\)/, 'the axis must take its colour from kind')
  for (const kind of ['stability', 'speed', 'intelligence']) {
    assert.ok(src.includes(`kind: '${kind}'`), `missing ${kind} axis`)
  }
  // An inline span accepts neither width nor height, so a fill drawn that way is
  // invisible — the first version shipped exactly that bug. The fill must be a
  // block-level box nested in a track that is a flex child.
  assert.match(src, /\.dflm-axis-fill \{ display: block;/, 'the fill must be block-level or its width is ignored')
  assert.match(src, /\.dflm-axis-track \{[^}]*flex: 1 1 auto;/, 'the track must grow inside the axis')
})

check('the ranking tab is usable, not just readable', () => {
  const src = readFileSync('./lib/client.js', 'utf8')
  // Every control the :3001 table has and this one can honestly support.
  assert.match(src, /className: 'dflm-switch'/, 'each row needs its own enable switch')
  // A switch carries its state in aria-checked; aria-pressed belongs to toggle
  // buttons and left screen readers announcing a pressed button instead of an
  // on/off switch. The knob is painted from the same attribute, so the CSS has
  // to agree or the switch always renders closed.
  assert.match(src, /'aria-checked': picked\.has\(row\.id\)/, 'the switch must report its state as aria-checked')
  assert.match(src, /\.dflm-switch\[aria-checked="true"\]/, 'the switch CSS must key off aria-checked')
  assert.ok(src.includes('const RANK_SORTS'), 'the table must be sortable')
  for (const key of ['rankAllOn', 'rankAllOff', 'rankShowing', 'rankModel']) {
    assert.ok(src.includes(key + ':'), 'missing ' + key + ' label')
  }
  // Filters the ranking data can actually answer.
  assert.match(src, /dflm\.rankVision/, 'vision filter')
  assert.match(src, /dflm\.rankTools/, 'tools filter')
  assert.match(src, /dflm\.rankCtx/, 'context-size filter')
  // The row shows the display name, not the routing slug: the slug is what the
  // API answers to, the name is what the dashboard shows.
  assert.match(src, /row\.name \|\| row\.id/, 'rows must fall back to id only when unnamed')
})

check('native selects follow the panel theme, not the OS default', () => {
  const src = readFileSync('./lib/client.js', 'utf8')
  // A native <select> popup is drawn by the browser from `color-scheme`, and
  // the host never sets it — so on a dark DSH the list opened white with a blue
  // highlight. Setting it on the panel root is the only thing that reaches the
  // popup; the option rule keeps the rows readable while it is open. Both are
  // easy to lose in a restyle, and the loss is invisible in a screenshot of the
  // closed control.
  assert.match(
    src,
    /\.dflm select option \{ background-color: var\(--dsw-alias-bg-layer-2/,
    'the open popup rows must use a theme surface',
  )
  assert.match(src, /function readScheme\(\)/, 'the panel must measure the active theme')
  assert.match(src, /dsw-alias-bg-layer-1/, 'readScheme must sample a theme surface token')
  assert.match(src, /function useColorScheme\(\)/, 'the scheme must be reactive')
  assert.match(src, /MutationObserver/, 'a theme flip must re-measure, not wait for a reload')
  assert.match(src, /colorScheme: scheme/, 'the measured scheme must reach the DOM')
  // Both surfaces that host a select need it: the panel and the settings view.
  assert.equal(
    (src.match(/useColorScheme\(\)/g) || []).length >= 3,
    true,
    'Panel and BundleConfig must both apply the measured scheme',
  )
})

check('a hung host cannot freeze the panel forever', () => {
  // Two fetches sit on the path between a stuck router and a dead panel: the
  // catalogue read in the host half and the request the panel makes. With no
  // ceiling the first never settles, so the status call never answers, the
  // client's queue never drains, and every later click waits behind it until a
  // page reload. Milliseconds are not the point — the presence of a signal is.
  const adapter = readFileSync('./lib/adapter.js', 'utf8')
  assert.match(adapter, /signal: AbortSignal\.timeout\(CATALOG_TIMEOUT_MS\)/, 'the catalogue read needs a timeout')
  assert.match(adapter, /const CATALOG_TIMEOUT_MS = \d+/, 'the catalogue timeout must be a named constant')
  const client = readFileSync('./lib/client.js', 'utf8')
  assert.match(client, /signal: AbortSignal\.timeout\(timeout\)/, 'the panel request needs a timeout')
  // `start` waits on the supervisor's 25s grace period, so one shared ceiling
  // would time out the only action that is legitimately slow.
  assert.match(client, /action === 'start' \? START_TIMEOUT_MS : CALL_TIMEOUT_MS/, 'start needs its own, longer ceiling')
  assert.match(client, /error\.name === 'TimeoutError'/, 'a timeout must surface as a message, not a raw DOMException')
})

check('the panel queues requests instead of dropping them', () => {
  const src = readFileSync('./lib/client.js', 'utf8')
  // The old guard was `if (busy.current) return;` — a click during a probe poll
  // was silently discarded: the button flashed and nothing was sent.
  assert.equal(src.includes('busy.current'), false, 'a click must never be dropped while a poll is in flight')
  assert.match(src, /queue\.current = queue\.current\.then\(run, run\)/, 'requests must queue, and survive a rejection')
  assert.match(src, /waitingStatus/, 'status polls must de-duplicate instead of stacking')
  // A poll that re-delivers an identical payload must not rebuild the tree.
  assert.match(src, /seen !== lastSeen\.current/, 'an unchanged payload must not trigger a re-render')
  // Lean polls omit the scores; they have to be merged back or the bars blink.
  assert.match(src, /const mergeRanks = \(data, patch\) =>/, 'lean replies must keep the scores the panel already has')
  assert.match(src, /void load\('status', \{ lean: true \}\)/, 'the probe poll must ask for the lean payload')
})

check('ranking reads are serialised and failures are not silent', () => {
  const src = readFileSync('./lib/ranking.js', 'utf8')
  // The vendored db handle is a module-level singleton: two overlapping reads
  // swap the connection out from under each other and one gets a closed handle.
  assert.match(src, /let chain = Promise\.resolve\(\)/, 'reads must go through one chain')
  assert.match(src, /chain = next\.catch\(\(\) => \{\}\)/, 'a rejected read must not break the chain')
  assert.match(src, /logger\.warn\(/, 'a failed read must log its reason')
  assert.match(src, /Date\.now\(\) - lastWarnAt > 60_000/, 'the warning must be throttled: this runs on every poll')
  // Dead and wrong: it was never read by the client, and its condition compared
  // against a value the loop had already overwritten.
  assert.equal(src.includes('sizeLabel'), false, 'sizeLabel was unused and computed incorrectly')
})

check('a failed spawn is an error the panel can show, not a crashed host', async () => {
  const src = readFileSync('./lib/supervisor.js', 'utf8')
  // A failed spawn emits 'error' on the child, not 'exit'. An unhandled 'error'
  // event is an uncaughtException in the HOST process, so one missing runtime
  // entry would take the whole app down.
  assert.match(src, /child\.on\('error'/, 'the spawned child needs an error listener')
  assert.match(src, /spawnError/, 'the loop must be able to see the spawn failure')
  assert.match(src, /if \(spawnError !== null\)/, 'a failed spawn must fail fast, not wait out the grace period')
  // taskkill can itself fail to spawn (missing from PATH); same class of bug.
  assert.match(src, /killer\.on\('error'/, 'the taskkill child needs an error listener too')

  // Behaviour, not just text: a package that lost its bundled runtime must
  // fail fast with a readable message instead of waiting out the 25s grace
  // period. The spawn 'error' branch above cannot be forced in-process (it
  // needs an unexecutable host binary), so it stays a structural assertion.
  const { DEFAULTS } = await import('./lib/store.js')
  const { Supervisor } = await import('./lib/supervisor.js')
  const { mkdtempSync } = await import('node:fs')
  const empty = mkdtempSync(path.join(os.tmpdir(), 'dflm-nospawn-'))
  const broken = new Supervisor({
    stateDir: empty,
    settings: () => ({ ...DEFAULTS, autoStart: false }),
    logger: { debug() {}, warn() {}, info() {} },
  })
  broken.reachable = async () => false
  broken.paths = () => ({
    entry: path.join(empty, 'vendor', 'server-dist', 'index.js'),
    clientDist: path.join(empty, 'vendor', 'client-dist'),
    dataDir: empty,
    dbPath: path.join(empty, 'data', 'freeapi.db'),
    envPath: path.join(empty, '.env'),
  })
  const started = Date.now()
  await assert.rejects(
    () => broken.startUnshared(),
    (error) => {
      assert.match(String(error.message), /reinstall the plugin/, 'the message must say what is missing')
      return true
    },
    'starting with no runtime entry must reject',
  )
  assert.ok(Date.now() - started < 10_000, 'it must not wait out the 25s grace period')
})

check('the router is torn down even when autoStart is off', () => {
  const src = readFileSync('./lib/index.js', 'utf8')
  // The panel, the tools and ensureRouter can all start the server with
  // autoStart off. If the cleanup sits inside the autoStart branch, that
  // manually started router outlives the app and keeps :3001 bound.
  const startAt = src.indexOf('if (settings.get().autoStart) {')
  const stopAt = src.indexOf("'dsh-freellmapi: stop the router'")
  assert.ok(startAt !== -1, 'the autostart branch must exist')
  assert.ok(stopAt !== -1, 'the stop effect must exist')
  assert.ok(startAt < stopAt, 'the stop effect must sit after, not inside, the autostart branch')
  // Indentation is the contract here: `apply` runs at two spaces, so anything
  // at that depth is a sibling of the autostart branch rather than a child.
  const effectLine = src.slice(0, stopAt).split('\n').reverse().find((line) => line.includes('ctx.effect('))
  assert.ok(effectLine !== undefined, 'the stop effect must be a ctx.effect call')
  assert.equal(
    effectLine.length - effectLine.trimStart().length,
    2,
    'the stop effect must be indented as a sibling of the autostart branch, not nested in it',
  )
})

check('1.2.7 regressions: the crash / lie / leak / hang fixes stay put', () => {
  const client = readFileSync('./lib/client.js', 'utf8')
  const index = readFileSync('./lib/index.js', 'utf8')
  const stream = readFileSync('./lib/stream.js', 'utf8')
  const supervisor = readFileSync('./lib/supervisor.js', 'utf8')
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
  const readme = readFileSync('./README.md', 'utf8')
  const readmeZh = readFileSync('./README.zh.md', 'utf8')

  // F7 — a non-numeric score must not crash React with toFixed().
  assert.match(client, /typeof row\.rank\.score === 'number' && Number\.isFinite\(row\.rank\.score\)/, 'scored rows must guard the score')
  assert.match(client, /Number\.isFinite\(row\.rank\.score\) \? row\.rank\.score\.toFixed\(3\) : '—'/, 'the score cell needs a fallback')
  // F8 — a failed save must not clear the draft and claim success.
  assert.match(client, /result\.ok !== true/, 'save must gate on the load result')
  assert.doesNotMatch(client, /await load\('save', \{ patch: draft \}\);\s*setDirty\(false\)/, 'save must not blindly report success')
  // F1 / F9 — one disposer for the main panel and one shared router.
  assert.match(client, /ctx\.effect\(\s*\(\) => ctx\.slots\.inject\('main'/, 'the main panel needs a ctx.effect owner')
  assert.match(client, /const queue = \{ current: Promise\.resolve\(\) \}/, 'one shared request queue')
  assert.match(client, /subscribe\('dflm\.state'/, 'state changes must reach every view')
  // T1 — [DONE] ends the stream instead of waiting for the read timeout.
  assert.match(stream, /payload === '\[DONE\]'\) return true/, '[DONE] must terminate the SSE loop')
  assert.match(stream, /decoder\.decode\(\)/, 'the trailing bytes must be flushed')
  // S1 — a failed startup tears its child down.
  assert.match(supervisor, /catch \(error\) \{\s*this\.stop\(\)/, 'a failed start must kill the child')
  // I1 / floating promise — the Origin guard, and the handler catches itself.
  //
  // The desktop app proxies this panel through its own `dsh-app://` protocol and
  // its forwarder strips `origin` and `host` before the request lands here, so a
  // POST from our own panel arrives with no Origin. Requiring the header locked
  // the panel out of its own API on the desktop (1.2.7 shipped that and showed
  // "origin rejected"). Assert the behaviour, not the source text: absent Origin
  // is fine on a loopback host, and still refused for anything else.
  assert.match(index, /void apiRoute\(req, res/, 'the panel handler must consume its own rejection')
  assert.match(index, /shouldStop: \(\) => disposed/, 'probe batches must stop after teardown')
  assert.equal(typeof panel.sameOrigin, 'function', 'the Origin guard must be importable to be tested')
  const guarded = (headers) => panel.sameOrigin({ headers })
  const allow = [
    [undefined, '127.0.0.1:51580', 'the desktop forwarder strips Origin'],
    [undefined, 'localhost:51580', 'a no-Origin request on localhost'],
    [undefined, '[::1]:51580', 'a no-Origin request on IPv6 loopback'],
    ['null', '127.0.0.1:51580', 'an opaque Origin on loopback'],
    ['http://127.0.0.1:51580', '127.0.0.1:51580', 'a browser same-origin POST'],
    ['http://localhost:51580', 'localhost:51580', 'a browser same-origin POST on localhost'],
    ['dsh-app://app', '127.0.0.1:51580', 'the desktop window posts under its own protocol'],
    ['dsh-app://shell', '127.0.0.1:51580', 'the desktop chrome posts under the same scheme'],
  ]
  for (const [origin, host, label] of allow) {
    assert.equal(guarded({ origin, host }), true, label)
  }
  const deny = [
    [undefined, 'evil.example.com', 'a no-Origin request from a remote host'],
    ['null', 'evil.example.com', 'an opaque Origin from a remote host'],
    ['https://evil.example.com', '127.0.0.1:51580', 'a foreign Origin'],
    ['dsh-appx://app', '127.0.0.1:51580', 'a lookalike of the desktop scheme'],
    ['dsh-app://app', 'evil.example.com', 'the desktop origin off loopback'],
    ['http://127.0.0.1:51580', '127.0.0.1:51581', 'an Origin for a different port'],
    [undefined, '', 'a request with no host at all'],
  ]
  for (const [origin, host, label] of deny) {
    assert.equal(guarded({ origin, host }), false, label)
  }
  // Publish gate — a tarball can no longer ship a stale install command.
  assert.equal(pkg.version, '1.2.11')
  assert.equal(pkg.scripts && pkg.scripts.prepack, 'node smoke.mjs')
  assert.equal(pkg.engines.node, '>=22.13.0')
  assert.match(readme, /releases\/download\/v1\.2\.11\/dsh-freellmapi-1\.2\.11\.tgz/)
  assert.match(readmeZh, /releases\/download\/v1\.2\.11\/dsh-freellmapi-1\.2\.11\.tgz/)
  assert.doesNotMatch(readme + readmeZh, /releases\/download\/v1\.2\.(?:[5-9]|10)\/dsh-freellmapi-1\.2\.(?:[5-9]|10)\.tgz/)
})

check('a fresh install comes up with the anonymous providers already enabled', async () => {
  const keyless = await import('./lib/keyless.js')
  const platforms = await keyless.keylessPlatforms()
  assert.ok(platforms.length >= 7, `the registry lists the anonymous providers, got ${platforms.length}`)
  for (const platform of ['aihorde', 'aisense', 'halx', 'keenable', 'kilo', 'ovh', 'parallel']) {
    assert.ok(platforms.includes(platform), `${platform} is a keyless provider and must be in the plan`)
  }
  // A database that does not exist yet has none of the rows: everything is missing.
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dflm-seed-'))
  const paths = runtime.runtimePaths(stateDir)
  const fresh = await keyless.planKeylessSeed(paths.dbPath)
  assert.deepEqual(fresh.missing, platforms, 'a brand-new database is missing every keyless platform')
  // Those missing platforms reach the child as the server's own declarative config.
  const seeded = runtime.childEnv(paths, { baseURL: 'http://127.0.0.1:3001/v1' }, fresh)
  assert.equal(typeof seeded.FREEAPI_CONFIG_JSON, 'string', 'the seed must be handed to the child process')
  const payload = JSON.parse(seeded.FREEAPI_CONFIG_JSON)
  assert.equal(payload.keys.length, platforms.length)
  assert.deepEqual(payload.keys.map((k) => k.platform).sort(), platforms, 'every keyless platform is declared')
  assert.equal('key' in payload.keys[0], false, 'a keyless platform declares no key at all')
  // Nothing to seed means the variable is absent, so nothing changes on a later boot.
  const empty = runtime.childEnv(paths, { baseURL: 'http://127.0.0.1:3001/v1' }, { missing: [] })
  assert.equal('FREEAPI_CONFIG_JSON' in empty, false, 'an already-seeded database must not re-declare anything')
  // An operator who set the variable by hand keeps their configuration.
  const saved = process.env.FREEAPI_CONFIG_JSON
  process.env.FREEAPI_CONFIG_JSON = '{"keys":[{"platform":"ovh","key":"manual"}]}'
  try {
    const handed = runtime.childEnv(paths, { baseURL: 'http://127.0.0.1:3001/v1' }, fresh)
    assert.equal(handed.FREEAPI_CONFIG_JSON, '{"keys":[{"platform":"ovh","key":"manual"}]}', 'a hand-written config wins')
  } finally {
    if (saved === undefined) delete process.env.FREEAPI_CONFIG_JSON
    else process.env.FREEAPI_CONFIG_JSON = saved
  }
  // And the supervisor is what asks for the plan, before it spawns.
  const supervisor = readFileSync('./lib/supervisor.js', 'utf8')
  assert.match(supervisor, /import \{ planKeylessSeed \} from '\.\/keyless\.js'/, 'the supervisor must own the seeding decision')
  assert.match(supervisor, /const seed = await planKeylessSeed\(paths\.dbPath\)/, 'the plan is built from the real database path')
  assert.match(supervisor, /env: childEnv\(paths, this\.settings\(\), seed\)/, 'the plan must reach the child environment')
  // The panel says it, or the feature is invisible to the person it is for.
  const index = readFileSync('./lib/index.js', 'utf8')
  const client = readFileSync('./lib/client.js', 'utf8')
  assert.match(index, /keyless: seeding === undefined/, 'status must report the keyless state')
  assert.match(index, /already: seeding\.platforms\.filter\(/, 'the panel needs what is already on')
  assert.match(index, /pending: seeding\.missing/, 'and what the next start would add')
  assert.match(index, /lean === true\s*\?\s*undefined\s*:\s*await planKeylessSeed/, 'a lean poll must not re-read the database')
  assert.match(client, /t\('keylessOn', \{ n: keyless\.already\.length \}\)/, 'the panel must show the enabled count')
  assert.match(client, /keylessPending/, 'and the providers a restart would add')
  fs.rmSync(stateDir, { recursive: true, force: true })
})

await Promise.all(pending)

// --- live router (opt-in) ---------------------------------------------------

if (process.argv.includes('--live')) {
  process.env.DSH_HOME ??= path.join(os.homedir(), '.dsh')
  const { DEFAULTS, SettingsFile } = await import('./lib/store.js')
  const { FreeLlmApiAdapter, ROUTE } = await import('./lib/adapter.js')
  const { readUnifiedKey, runtimePaths } = await import('./lib/runtime.js')
  const stateDir = path.join(process.env.DSH_HOME, 'dsh-freellmapi')
  const baseURL = DEFAULTS.baseURL
  let apiKey
  try {
    const env = readFileSync(path.join(process.env.DSH_HOME, '.env'), 'utf8')
    apiKey = env.match(/^FREELLMAPI_API_KEY=(.+)$/m)?.[1]?.trim()
  } catch {
    apiKey = undefined
  }
  // A self-contained install has no reason to need an exported key: the bundled
  // router mints one on first boot, and that is the key the plugin uses.
  apiKey ??= await readUnifiedKey(runtimePaths(stateDir).dbPath)
  // Same lane the picker uses: if the router is down, bring it up rather than
  // declaring the check skipped. A first-ever boot also mints the key.
  const { Supervisor } = await import('./lib/supervisor.js')
  const saved = new SettingsFile(stateDir).get()
  const supervisor = new Supervisor({
    stateDir,
    settings: () => ({ ...DEFAULTS, ...saved }),
    logger: { debug() {}, warn() {}, info() {} },
  })
  const ensureUp = async () => {
    await supervisor.start({
      onKey: async (key) => {
        apiKey ??= key
      },
    })
    return true
  }
  await ensureUp().catch((error) => console.log(`skip live: ${error.message}`))
  if (apiKey === undefined) {
    console.log('skip live: the router has not minted a unified key yet (start it once)')
  } else {
    const adapter = new FreeLlmApiAdapter({
      settings: () => ({ ...DEFAULTS, ...saved, baseURL, apiKey }),
      logger: { debug() {}, warn() {}, info() {} },
      ensureUp,
    })
    // A stopped router is a skip, not a failure: this layer proves the wire
    // format, and it cannot do that against nothing listening.
    let rows
    try {
      rows = await adapter.fetchCatalog(baseURL, apiKey)
    } catch (error) {
      if (error.code !== 'TRANSPORT') throw error
      console.log(`skip live: ${error.message} — start the router first`)
    }
    if (rows === undefined) {
      // nothing to assert against; the offline layer already ran
    } else {
      console.log(`ok   live: router catalogue has ${rows.length} model(s), ${rows.filter((r) => r.available).length} available`)
      const model = rows.find((row) => row.id === 'auto')
      assert.ok(model, 'the router must always offer `auto`')
      const prepared = await adapter.prepareCall(ROUTE, 'auto')
      const chunks = []
      for await (const chunk of prepared.stream({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Say PONG and nothing else.' }] }], maxTokens: 256 })) {
        chunks.push(chunk)
      }
      const text = chunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('').trim()
      assert.ok(text.length > 0, 'the router answered with no text')
      assert.equal(chunks.at(-1).type, 'finish')
      console.log(`ok   live: auto answered ${JSON.stringify(text.slice(0, 40))} via ${prepared.model.id}`)
    }
  }
  // This script spawned the router, so it must not leave the process alive: a
  // live check that never exits is indistinguishable from a hang. taskkill is
  // asynchronous, so wait for the port to actually close before returning.
  supervisor.stop()
  for (let i = 0; i < 40 && (await supervisor.reachable(100)); i += 1) {
    await new Promise((r) => setTimeout(r, 100))
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
