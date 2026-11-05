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
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { toChatMessages, toToolDefs, repairToolPairing } from './lib/chat.js'
import { BlockWriter, CODE, classifyStatus, finishReason, mapUsage, readChatStream } from './lib/stream.js'
import { normalize } from './lib/store.js'

const failures = []
function check(label, body) {
  try {
    body()
    console.log(`ok   ${label}`)
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
    console.log(`FAIL ${label}: ${error.message}`)
  }
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
  if (apiKey === undefined) {
    console.log('skip live: the router has not minted a unified key yet (start it once)')
  } else {
    const saved = new SettingsFile(stateDir).get()
    const adapter = new FreeLlmApiAdapter({
      settings: () => ({ ...DEFAULTS, ...saved, baseURL, apiKey }),
      logger: { debug() {}, warn() {}, info() {} },
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
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
