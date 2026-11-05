/**
 * Plugin settings and the resolved connection to the local router.
 *
 * Settings live in one JSON file under the harness home so a settings change is
 * a file write, not a Cordis patch rewrite. The unified key is never stored here:
 * it is resolved through the harness credential seam first, which is where every
 * other provider key on this machine already lives.
 *
 * @module lib/store
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DATA_DIR = 'dsh-freellmapi'
export const CREDENTIAL_NAME = 'FREELLMAPI_API_KEY'

export const PROXY_MODES = Object.freeze(['inherit', 'direct'])

export const DEFAULTS = Object.freeze({
  baseURL: 'http://127.0.0.1:3001/v1',
  requestTimeoutMs: 300_000,
  defaultMaxTokens: 8192,
  // The router ships inside this package, so starting it is the normal case:
  // an install that leaves it off is the one that needs explaining.
  autoStart: true,
  // The router reads the OS proxy settings and routes every upstream call
  // through them. That is right on a machine where the proxy works and fatal on
  // one where it does not: the dashboard still loads (it is local) while every
  // provider answer fails with ECONNRESET. `direct` sets NO_PROXY=* so a broken
  // system proxy cannot silently take the whole router down.
  proxy: 'inherit',
})

export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  return path.join(os.homedir(), '.dsh')
}

/** Coerce arbitrary config into the settings shape, refusing a value that cannot work. */
export function normalize(input) {
  const source = input !== null && typeof input === 'object' ? input : {}
  const baseURL = typeof source.baseURL === 'string' && source.baseURL.trim() !== ''
    ? source.baseURL.trim()
    : DEFAULTS.baseURL
  const url = new URL(baseURL)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`baseURL must be an http(s) address, got ${baseURL}`)
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  const timeout = Number(source.requestTimeoutMs)
  const maxTokens = Number(source.defaultMaxTokens)
  return {
    baseURL: url.toString().replace(/\/+$/, ''),
    requestTimeoutMs: Number.isFinite(timeout) && timeout >= 1000 ? Math.trunc(timeout) : DEFAULTS.requestTimeoutMs,
    defaultMaxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.trunc(maxTokens) : DEFAULTS.defaultMaxTokens,
    autoStart: source.autoStart !== false,
    proxy: PROXY_MODES.includes(source.proxy) ? source.proxy : DEFAULTS.proxy,
  }
}

export class SettingsFile {
  constructor(dir) {
    this.dir = dir
    this.file = path.join(dir, 'settings.json')
    this.value = this.read()
  }

  read() {
    try {
      return normalize(JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch (error) {
      // A first run has no file. A corrupt one must not be silently replaced
      // with defaults — the operator would lose a start command without a clue.
      if (error?.code !== 'ENOENT') {
        throw new Error(`settings at ${this.file} are unreadable: ${error.message}`)
      }
      return { ...DEFAULTS }
    }
  }

  get() {
    return this.value
  }

  save(patch) {
    const next = normalize({ ...this.value, ...(patch ?? {}) })
    fs.mkdirSync(this.dir, { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, this.file)
    this.value = next
    return next
  }
}

/**
 * Resolve the unified key through the harness credential seam.
 *
 * The seam resolves stored file → launch environment → project `.env` →
 * `$DSH_HOME/.env`, so the key can be pasted once in the panel, exported, or left
 * in the harness-home `.env` this machine already uses. The plugin never keeps a
 * copy of its own: a second place a secret can live is a second place to leak it.
 */
export async function resolveApiKey(ctx) {
  try {
    // `ctx.credentials` throws unless injected; `ctx.get` asks opportunistically,
    // which is what an optional seam needs.
    const seam = ctx?.get?.('credentials')
    const resolve = seam?.resolve
    if (typeof resolve === 'function') {
      const hit = await resolve.call(seam, CREDENTIAL_NAME)
      const value = typeof hit === 'string' ? hit : hit?.value
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
    }
  } catch {
    // An absent seam is a missing key, not a broken plugin.
  }
  // A composition without the credential seam (headless, minimal bundles) still
  // gets the launch environment — the same layer the seam itself consults.
  const fromEnv = process.env[CREDENTIAL_NAME]
  return typeof fromEnv === 'string' && fromEnv.trim() !== '' ? fromEnv.trim() : undefined
}
