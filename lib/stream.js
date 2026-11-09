/**
 * Server-Sent Events → harness `StreamChunk`s.
 *
 * The router answers the Chat wire, so one SSE loop covers every route it fronts:
 * virtual ids (`auto`, `fusion`, `auto:<profile>`) and real model ids alike.
 * Provider identity is irrelevant here; only the wire shape is.
 *
 * @module lib/stream
 */

/** Canonical failure codes the harness routes on. */
export const CODE = Object.freeze({
  transport: 'TRANSPORT',
  timeout: 'TIMEOUT',
  server: 'SERVER',
  rateLimit: 'RATE_LIMIT',
  credential: 'INVALID_CREDENTIAL',
  empty: 'EMPTY_RESPONSE',
  aborted: 'ABORTED',
  contextWindow: 'CONTEXT_WINDOW_EXCEEDED',
  unsupported: 'UNSUPPORTED',
  unavailable: 'SERVICE_UNAVAILABLE',
})

/**
 * One thrown failure with a stable code.
 *
 * The harness writes `code`/`status`/`providerRetryAfterMs` into a durable
 * session event, so only plain validated values are carried — never an Error or
 * an explicit `undefined`.
 */
export class ApiError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    Object.assign(this, details)
  }
}

/**
 * Assigns harness block indexes by first appearance and closes every open block.
 *
 * Chat has no block vocabulary: text, reasoning and tool calls arrive as
 * independent delta streams keyed by a tool `index`. A harness consumer needs
 * `block-start`/`block-end` boundaries, so each distinct stream claims an index
 * on its first delta and keeps it for the whole turn.
 */
export class BlockWriter {
  constructor(emit) {
    this.emit = emit
    this.blocks = new Map()
    this.next = 0
    this.answered = false
  }

  slot(key, kind) {
    let block = this.blocks.get(key)
    if (block === undefined) {
      block = { index: this.next, kind, text: '', name: '', id: '', args: '' }
      this.next += 1
      this.blocks.set(key, block)
      this.emit({ type: 'block-start', index: block.index, blockType: kind })
    }
    return block
  }

  text(chunk) {
    const block = this.slot('text', 'text')
    block.text += chunk
    if (chunk.trim() !== '') this.answered = true
    this.emit({ type: 'text-delta', index: block.index, text: chunk })
  }

  reasoning(chunk) {
    const block = this.slot('reasoning', 'reasoning')
    block.text += chunk
    this.emit({ type: 'reasoning-delta', index: block.index, text: chunk })
  }

  toolStart(key, id, name) {
    const block = this.slot(`tool:${key}`, 'tool-call')
    this.answered = true
    if (id !== '' && block.id === '') block.id = id
    if (name !== '' && block.name === '') block.name = name
    this.emit({
      type: 'tool-call-delta',
      index: block.index,
      id: block.id,
      ...(block.name === '' ? {} : { name: block.name }),
      argumentsDelta: '',
    })
  }

  toolArgs(key, delta) {
    const block = this.slot(`tool:${key}`, 'tool-call')
    this.answered = true
    block.args += delta
    this.emit({ type: 'tool-call-delta', index: block.index, id: block.id, argumentsDelta: delta })
  }

  closeAll() {
    for (const block of this.blocks.values()) {
      if (block.kind === 'tool-call') {
        // Empty strings, never undefined: the durable log rejects undefined fields.
        this.emit({
          type: 'block-end',
          index: block.index,
          block: { type: 'tool-call', id: block.id, name: block.name, arguments: block.args },
        })
      } else if (block.kind === 'reasoning') {
        this.emit({ type: 'block-end', index: block.index, block: { type: 'reasoning', text: block.text } })
      } else {
        this.emit({ type: 'block-end', index: block.index, block: { type: 'text', text: block.text } })
      }
    }
    this.blocks.clear()
  }
}

/**
 * Map Chat's finish token onto a harness finish reason.
 *
 * `tool_calls` must win over the presence of tool blocks: the loop decides
 * whether to dispatch tools from this reason alone.
 */
export function finishReason(token) {
  if (token === 'tool_calls' || token === 'tool_use' || token === 'function_call') return { kind: 'tool-calls' }
  if (token === 'length' || token === 'max_tokens' || token === 'max_output_tokens' || token === 'incomplete') {
    return { kind: 'max-tokens' }
  }
  return { kind: 'stop' }
}

/**
 * Usage counters without overlap.
 *
 * `inputTokens` excludes cache reads, and `reasoningTokens` is reported as the
 * informational subset it is — adding it again would double-bill the turn.
 */
export function mapUsage(usage) {
  if (usage === null || typeof usage !== 'object') return undefined
  const prompt = Number(usage.prompt_tokens) || 0
  const completion = Number(usage.completion_tokens) || 0
  const cached = Number(usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens) || 0
  const reasoning = Number(usage.completion_tokens_details?.reasoning_tokens) || 0
  const out = {
    inputTokens: Math.max(0, prompt - cached),
    outputTokens: completion,
    totalTokens: prompt + completion,
  }
  if (cached > 0) out.cacheReadTokens = cached
  if (reasoning > 0) out.reasoningTokens = reasoning
  return out
}

const CONTEXT_HINTS = /context length|context window|maximum context|too many tokens|reduce the length/i

/** Classify an HTTP failure body into a stable code. */
export function classifyStatus(status, bodyText) {
  if (status === 401 || status === 403) return CODE.credential
  if (status === 429) return CODE.rateLimit
  if (status === 503) return CODE.unavailable
  if (status >= 500) return CODE.server
  if (CONTEXT_HINTS.test(bodyText)) return CODE.contextWindow
  return CODE.transport
}

/** Extract the router's own error message when it sent one. */
function messageOf(bodyText) {
  try {
    const parsed = JSON.parse(bodyText)
    const message = parsed?.error?.message ?? parsed?.message
    if (typeof message === 'string' && message !== '') return message
  } catch {
    // Not JSON: the raw body is still the best explanation available.
  }
  return bodyText.slice(0, 500)
}

/**
 * Read one SSE response into harness chunks.
 *
 * Deltas are yielded as they arrive; usage and finish are held until the provider
 * signals end-of-stream, so a trailing usage-only chunk cannot arrive after
 * `finish`. An empty completion becomes a retryable error rather than a silently
 * successful empty turn.
 *
 * @param {Response} response - an accepted streaming response
 * @param {AbortSignal} [signal] - caller abort, honoured while reading
 */
export async function* readChatStream(response, signal) {
  const out = []
  const writer = new BlockWriter((chunk) => out.push(chunk))
  const drain = function* () {
    while (out.length > 0) yield out.shift()
  }

  const body = response.body
  if (body === null || body === undefined) {
    throw new ApiError('the router returned no response body', CODE.transport)
  }

  let usage
  let terminal = null
  let buffer = ''
  const reader = body.getReader()
  const decoder = new TextDecoder()

  const handle = (payload) => {
    let event
    try {
      event = JSON.parse(payload)
    } catch {
      throw new ApiError(`malformed stream event: ${payload.slice(0, 200)}`, CODE.transport)
    }

    const eventUsage = mapUsage(event.usage)
    if (eventUsage !== undefined) usage = eventUsage

    const choice = Array.isArray(event.choices) ? event.choices[0] : undefined
    if (choice === undefined) return

    const delta = choice.delta ?? {}
    // `reasoning` is this router's spelling; `reasoning_content` is the
    // OpenAI-compatible one other gateways use. Both are thinking, not answer.
    const thinking = delta.reasoning_content ?? delta.reasoning
    if (typeof thinking === 'string' && thinking !== '') writer.reasoning(thinking)
    if (typeof delta.content === 'string' && delta.content !== '') writer.text(delta.content)

    if (Array.isArray(delta.tool_calls)) {
      for (const call of delta.tool_calls) {
        const key = String(call?.index ?? 0)
        const id = typeof call?.id === 'string' ? call.id : ''
        const name = typeof call?.function?.name === 'string' ? call.function.name : ''
        if (id !== '' || name !== '') writer.toolStart(key, id, name)
        const args = call?.function?.arguments
        if (typeof args === 'string' && args !== '') writer.toolArgs(key, args)
        else if (args !== null && typeof args === 'object') writer.toolArgs(key, JSON.stringify(args))
      }
    }

    if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
      terminal = choice.finish_reason
    }
  }

  const handleLine = (raw) => {
    const line = raw.replace(/\r$/, '')
    if (!line.startsWith('data:')) return false
    const payload = line.slice(5).trim()
    if (payload === '') return false
    if (payload === '[DONE]') return true
    handle(payload)
    return false
  }
  let done = false
  try {
    while (!done) {
      if (signal?.aborted === true) throw new ApiError('request aborted', CODE.aborted)
      const step = await reader.read()
      let ended = false
      if (step.done) {
        // Flush the decoder: a multi-byte character split across the last two
        // chunks otherwise loses its tail.
        buffer += decoder.decode()
        ended = true
      } else {
        buffer += decoder.decode(step.value, { stream: true })
      }
      let index = buffer.indexOf('\n')
      while (index !== -1) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (handleLine(line)) { done = true; break }
        yield* drain()
      }
      if (ended) {
        // The stream can end mid-line, with no trailing newline to split on.
        if (buffer.trim() !== '') {
          handleLine(buffer)
          yield* drain()
        }
        done = true
      }
    }
  } finally {
    reader.cancel?.().catch?.(() => {})
  }

  const answered = writer.answered
  writer.closeAll()
  yield* drain()

  if (signal?.aborted === true) throw new ApiError('request aborted', CODE.aborted)
  if (terminal === null) throw new ApiError('the stream ended before a finish reason arrived', CODE.transport)

  const reason = finishReason(terminal)
  // A terminal `stop` with nothing in it is a retryable failure, not success:
  // the agent would otherwise record an empty assistant turn and stall.
  if (reason.kind === 'stop' && answered === false) {
    if (usage !== undefined) yield { type: 'usage', usage }
    yield {
      type: 'finish',
      reason: {
        kind: 'error',
        failure: { message: 'the router returned an empty completion', code: CODE.empty },
      },
    }
    return
  }

  if (usage !== undefined) yield { type: 'usage', usage }
  yield { type: 'finish', reason }
}

/** Throw the same classification for a failed response body. */
export async function failFromResponse(response) {
  const text = await response.text().catch(() => '')
  throw new ApiError(
    messageOf(text) || `the router answered HTTP ${response.status}`,
    classifyStatus(response.status, text),
    { status: response.status },
  )
}
