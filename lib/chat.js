/**
 * Harness message vocabulary → OpenAI Chat Completions wire shape.
 *
 * The two shapes disagree in a way that silently breaks tool rounds rather than
 * erroring: the harness keeps tool calls inside assistant content blocks and
 * tool answers as messages keyed by call id, while Chat wants `tool_calls` on the
 * assistant turn and one `role: 'tool'` message per result. An upstream that
 * receives a tool answer with no matching call rejects the whole turn with 400 —
 * which then fails every later turn in that session, not just the broken one.
 *
 * @module lib/chat
 */

/** Normalise content into a block list; the harness always supplies blocks, forwarders may not. */
function blocksOf(content) {
  if (typeof content === 'string') return content === '' ? [] : [{ type: 'text', text: content }]
  if (!Array.isArray(content)) return []
  return content
    .map((part) => {
      if (typeof part === 'string') return { type: 'text', text: part }
      if (part?.type === 'text' || part?.type === 'input_text' || part?.type === 'output_text') {
        return { type: 'text', text: String(part.text ?? '') }
      }
      return part
    })
    .filter((block) => block !== null && typeof block === 'object')
}

function textOf(blocks) {
  const parts = []
  for (const block of blocks ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

function callIdOf(message) {
  const id = String(message?.toolCallId ?? message?.source?.callId ?? '')
  return id === '' ? null : id
}

function imageUrl(block, resolveImage) {
  if (block?.offloaded === true) return undefined
  return resolveImage?.(block.attachment) ?? (typeof block.attachment?.url === 'string' ? block.attachment.url : undefined)
}

/**
 * The tool answers one message carries, in either session generation.
 *
 * Before V4 a tool answer was a `user` message wrapping `tool-result` blocks;
 * V4 made it a first-class `tool` message whose content *is* the result. A
 * projector that reads only one of them ships every tool-using turn with its
 * results missing.
 */
function toolResultsOf(message) {
  if (message?.role === 'tool') {
    const blocks = blocksOf(message.content)
    // V4 puts the id on the message; a legacy `tool-result` block keeps it inside,
    // where its content also lives. Reading only the message would delete a
    // result whose call is still live and leave the call unanswered.
    const nested = blocks.find((block) => block?.type === 'tool-result')
    const id = callIdOf(message) ?? callIdOf(nested)
    if (id === null) return []
    return [{ callId: id, content: nested === undefined ? blocks : blocksOf(nested.content) }]
  }
  const out = []
  for (const block of blocksOf(message?.content)) {
    if (block?.type !== 'tool-result') continue
    const id = String(block.toolCallId ?? message?.source?.callId ?? '')
    if (id === '') continue
    out.push({ callId: id, content: blocksOf(block.content) })
  }
  return out
}

/**
 * Drop tool calls that were never answered, and answers whose call is gone.
 *
 * A turn interrupted between call and result — tool failed to start, user
 * aborted, host crashed — leaves exactly that in the durable history. Chat
 * rejects it with 400, so the repair has to happen before projection.
 */
export function repairToolPairing(messages) {
  const list = messages ?? []
  const answered = new Set()
  for (const message of list) {
    for (const result of toolResultsOf(message)) answered.add(result.callId)
  }

  const kept = new Set()
  const out = []
  for (const message of list) {
    const results = toolResultsOf(message)
    if (results.length > 0) {
      if (message.role === 'tool') {
        if (kept.has(results[0].callId)) out.push(message)
        continue
      }
      const blocks = blocksOf(message.content)
      const rest = blocks.filter(
        (block) =>
          block?.type !== 'tool-result'
          || kept.has(String(block.toolCallId ?? message.source?.callId ?? '')),
      )
      if (rest.length === blocks.length) out.push(message)
      else if (rest.length > 0) out.push({ ...message, content: rest })
      continue
    }
    // A tool answer with no id answers nothing; an empty `tool_call_id` is a 400.
    if (message?.role === 'tool') continue
    if (message?.role !== 'assistant') {
      out.push(message)
      continue
    }
    const blocks = blocksOf(message.content)
    const toolBlocks = blocks.filter((block) => block?.type === 'tool-call')
    // A call with no name cannot be executed, so it was answered with an error
    // and must not stay in history as a live call.
    const calls = toolBlocks.filter(
      (block) => answered.has(String(block.id ?? '')) && String(block.name ?? '') !== '',
    )
    for (const call of calls) kept.add(String(call.id))
    if (calls.length === toolBlocks.length) {
      if (calls.length > 0 || blocks.some((block) => block?.type === 'text' && block.text)) out.push(message)
      continue
    }
    const surviving = blocks.filter(
      (block) => block?.type !== 'tool-call' || calls.includes(block),
    )
    if (surviving.length > 0) out.push({ ...message, content: surviving })
  }
  return out
}

/**
 * Project harness messages onto OpenAI Chat Completions.
 *
 * Tool results travel as `role: 'tool'` before any image or user content, because
 * a parallel call batch must be answered contiguously. `role: 'tool'` carries
 * text only, so images a tool returned follow as a user turn.
 */
export function toChatMessages(messages, resolveImage, warnings = []) {
  const out = []
  const followUp = []
  const flushFollowUp = () => {
    if (followUp.length > 0) out.push({ role: 'user', content: followUp.splice(0) })
  }

  for (const message of messages ?? []) {
    const results = toolResultsOf(message)
    if (results.length === 0) flushFollowUp()
    let blocks = blocksOf(message.content)

    if (results.length > 0) {
      for (const result of results) {
        const images = []
        for (const block of result.content) {
          if (block?.type !== 'image') continue
          const url = imageUrl(block, resolveImage)
          if (url !== undefined) images.push({ type: 'image_url', image_url: { url } })
          else warnings.push('image-dropped')
        }
        const text = textOf(result.content)
        out.push({
          role: 'tool',
          tool_call_id: result.callId,
          content: text || (images.length > 0 ? '(see attached image)' : '(no output)'),
        })
        if (images.length > 0) {
          followUp.push(
            { type: 'text', text: `The result of tool call ${result.callId} is ${images.length} image(s), attached below.` },
            ...images,
          )
        }
      }
      blocks = blocks.filter((block) => block?.type !== 'tool-result')
    }

    switch (message.role) {
      case 'system':
      case 'developer': {
        const text = textOf(blocks)
        if (text) out.push({ role: 'system', content: text })
        break
      }
      case 'user': {
        const parts = []
        for (const block of blocks) {
          if (block?.type === 'text' && block.text) parts.push({ type: 'text', text: block.text })
          else if (block?.type === 'image') {
            const url = imageUrl(block, resolveImage)
            if (url !== undefined) parts.push({ type: 'image_url', image_url: { url } })
            else warnings.push('image-dropped')
          }
        }
        if (parts.length === 0) {
          const fallback = textOf(blocks)
          if (fallback) out.push({ role: 'user', content: fallback })
          break
        }
        if (results.length > 0) followUp.push(...parts)
        else out.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts })
        break
      }
      case 'assistant': {
        const text = textOf(blocks)
        const calls = []
        for (const block of blocks) {
          if (block?.type !== 'tool-call') continue
          calls.push({
            id: String(block.id ?? ''),
            type: 'function',
            function: {
              name: String(block.name ?? ''),
              arguments: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(block.arguments ?? {}),
            },
          })
        }
        if (!text && calls.length === 0) break
        const entry = { role: 'assistant', content: text || null }
        if (calls.length > 0) entry.tool_calls = calls
        out.push(entry)
        break
      }
      default:
        break
    }
  }

  flushFollowUp()
  return out
}

/** Harness tool schemas → Chat `tools`. Unnamed defs are dropped, never sent empty. */
export function toToolDefs(tools) {
  const list = []
  for (const tool of tools ?? []) {
    const source = tool && typeof tool.function === 'object' && tool.function !== null ? tool.function : tool
    const name = String(source?.name ?? '').trim()
    if (!name) continue
    const parameters = source?.parameters && typeof source.parameters === 'object'
      ? source.parameters
      : { type: 'object', properties: {} }
    list.push({
      type: 'function',
      function: {
        name,
        description: typeof source?.description === 'string' ? source.description : '',
        parameters,
      },
    })
  }
  return list
}
