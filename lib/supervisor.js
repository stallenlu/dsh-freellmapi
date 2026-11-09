/**
 * Starts, stops and reports the bundled FreeLLMAPI server.
 *
 * The router is a child process of the harness. It is launched with
 * `process.execPath`, which is the harness binary itself: with
 * `ELECTRON_RUN_AS_NODE=1` in the child environment that binary behaves as
 * Node, so the router runs on the packaged desktop app without a system Node
 * install and without a shell.
 *
 * @module lib/supervisor
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'

import { assertInstalled, childEnv, ensureRuntime, readUnifiedKey, runtimePaths } from './runtime.js'

/** How long a started process gets to bind its port before it counts as failed. */
const STARTUP_GRACE_MS = 25_000

export class Supervisor {
  /**
   * @param {object} options
   * @param {string} options.stateDir  plugin state directory under the harness home
   * @param {() => { baseURL: string }} options.settings
   * @param {{ info?: Function, warn?: Function, debug?: Function }} [options.logger]
   */
  constructor(options) {
    this.stateDir = options.stateDir
    this.settings = options.settings
    this.logger = options.logger
    this.child = null
    this.startedAt = 0
    this.lastError = ''
    this.output = []
    /** @type {Promise<object> | null} coalesces concurrent start() calls. */
    this.starting = null
  }

  paths() {
    return ensureRuntime(runtimePaths(this.stateDir))
  }

  /** Is something listening at the router's address? */
  async reachable(timeoutMs = 1500) {
    const target = new URL(this.settings().baseURL)
    const port = Number(target.port) || (target.protocol === 'https:' ? 443 : 80)
    const host = target.hostname === 'localhost' ? '127.0.0.1' : target.hostname
    return await new Promise((resolve) => {
      const socket = net.connect({ host, port })
      const done = (value) => {
        socket.removeAllListeners()
        socket.destroy()
        resolve(value)
      }
      socket.setTimeout(timeoutMs, () => done(false))
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
    })
  }

  status() {
    return {
      running: this.child !== null && this.child.exitCode === null,
      pid: this.child?.pid ?? null,
      uptimeMs: this.startedAt === 0 ? 0 : Date.now() - this.startedAt,
      lastError: this.lastError,
      output: this.output.slice(-40),
      entry: runtimePaths(this.stateDir).entry,
    }
  }

  /**
   * Start the bundled server and wait for its port to answer.
   *
   * `onKey` receives the router's unified key once the database exists, so the
   * caller can feed it to the model lane without the user copying anything.
   * @param {{ onKey?: (key: string) => void | Promise<void> }} [hooks]
   */
  async start(hooks = {}) {
    // One start at a time. The harness resolves metadata and prepares a call for
    // the same completion, so two lanes ask at once; without this they both see
    // a free port, both spawn, and the loser dies on EADDRINUSE.
    const inFlight = this.starting
    if (inFlight !== null) return await inFlight
    this.starting = this.startUnshared(hooks)
    try {
      return await this.starting
    } finally {
      this.starting = null
    }
  }

  async startUnshared(hooks = {}) {
    if (await this.reachable()) {
      // The endpoint answers, so an older failed attempt no longer describes
      // reality: drop it rather than show "running" next to a dead error.
      this.lastError = ''
      if (hooks.onKey !== undefined) await this.reportKey(hooks.onKey)
      return { started: false, alreadyRunning: true, ...this.status() }
    }
    const paths = assertInstalled(this.paths())
    this.output = []
    this.lastError = ''

    const child = spawn(process.execPath, [paths.entry], {
      cwd: this.stateDir,
      // A GUI host has no console: without this every start opens a black window.
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv(paths, this.settings()),
    })
    this.child = child
    this.startedAt = Date.now()

    // A failed spawn (ENOENT/EACCES on the runtime entry) emits 'error', not
    // 'exit'. Without this listener Node throws an uncaughtException, and the
    // start loop below would otherwise wait the whole startup grace period.
    let spawnError = null
    child.on('error', (error) => {
      spawnError = error
      if (this.child === child) {
        this.child = null
        this.startedAt = 0
        this.lastError = `the bundled server could not be started: ${error?.message ?? String(error)}`
        this.logger?.warn?.(`dsh-freellmapi: ${this.lastError}`)
      }
    })

    const record = (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim() === '') continue
        this.output.push(line)
        if (this.output.length > 200) this.output.shift()
      }
    }
    child.stdout?.on('data', record)
    child.stderr?.on('data', record)
    child.once('exit', (code, signal) => {
      if (this.child === child) {
        // Drop the handle: a dead child keeping `pid` makes the panel report a
        // process that no longer exists.
        this.child = null
        this.startedAt = 0
        const why = signal !== null ? `the server exited with signal ${signal}` : `the server exited with code ${code}`
        // The exit code alone never says why. The child printed the reason to
        // stdout/stderr (usually "listen EADDRINUSE"), so carry the tail.
        this.lastError = describeExit(why, this.output)
        this.logger?.warn?.(`dsh-freellmapi: ${this.lastError}`)
      }
    })

    const deadline = Date.now() + STARTUP_GRACE_MS
    try {
    for (;;) {
      // A spawn failure emits 'error' (not 'exit'); fail fast instead of
      // waiting the full startup grace period for a child that never existed.
      if (spawnError !== null) {
        throw new Error(this.lastError || `the bundled server could not be started: ${spawnError.message ?? spawnError}`)
      }
      if (await this.reachable(800)) {
        this.logger?.info?.(`dsh-freellmapi: router listening after ${Date.now() - this.startedAt} ms`)
        if (hooks.onKey !== undefined) await this.reportKey(hooks.onKey)
        return { started: true, alreadyRunning: false, ...this.status() }
      }
      if (child.exitCode !== null) {
        // A port that answers now but was free when we spawned means a second
        // router won the race. Say that instead of blaming our own exit code.
        if (await this.reachable(800)) {
          throw new Error(
            `another process took ${this.settings().baseURL} while the bundled server was starting; `
            + 'stop that process, or point the endpoint somewhere else',
          )
        }
        throw new Error(describeExit(`the bundled server exited with code ${child.exitCode}`, this.output))
      }
      if (Date.now() > deadline) {
        throw new Error(
          `the router did not answer within ${Math.round(STARTUP_GRACE_MS / 1000)} s${this.tailForError()}`,
        )
      }
      await sleep(500)
    }
    // A timeout, an exited child or a failed spawn used to leave the process
    // alive: it kept the port, and the next start saw it as "already running"
    // while it was in fact a half-booted router.
    } catch (error) {
      this.stop()
      throw error
    }
  }

  /** Hand the unified key to the caller, retrying while the first boot migrates. */
  async reportKey(onKey) {
    const { dbPath } = runtimePaths(this.stateDir)
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const key = await readUnifiedKey(dbPath)
      if (key !== undefined) {
        await onKey(key)
        return key
      }
      await sleep(250)
    }
    this.logger?.warn?.('dsh-freellmapi: the router is up but no unified key was found in its database')
    return undefined
  }

  stop() {
    const child = this.child
    this.child = null
    this.startedAt = 0
    if (child === null) return { stopped: false, reason: 'no server was started by this plugin' }
    // The server spawns no grandchildren, but on Windows a plain kill can leave
    // the listening socket briefly bound; taskkill /t makes the port free now.
    if (process.platform === 'win32') {
      // taskkill can fail to spawn (e.g. missing from PATH); without this the
      // 'error' event becomes an uncaughtException that takes down the host.
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
      killer.on('error', (error) => {
        this.logger?.warn?.(`dsh-freellmapi: taskkill could not run: ${error?.message ?? String(error)}`)
      })
    } else {
      child.kill('SIGTERM')
    }
    return { stopped: true, pid: child.pid }
  }

  tailForError() {
    const tail = this.output.slice(-8).join('\n')
    return tail === '' ? '' : `\n${tail}`
  }
}

/**
 * Turn a child exit into a sentence that says why, not just which code.
 *
 * The router prints its reason ("listen EADDRINUSE: address already in use
 * 127.0.0.1:3001") and then exits non-zero. Reporting only the code leaves the
 * user with nothing to act on, and the port conflict is the common case: a
 * router left running from an earlier session holds the port.
 */
function describeExit(headline, output) {
  const tail = output.slice(-8)
  const conflict = tail.find((line) => /EADDRINUSE|address already in use/i.test(line))
  if (conflict !== undefined) {
    return `${headline}: its port is already taken by another process — `
      + 'stop that one, or change the endpoint in this panel'
  }
  return tail.length === 0 ? headline : `${headline}\n${tail.join('\n')}`
}

export { describeExit }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Whether the vendored tree is on disk, for the panel to show up front. */
export function installationStatus(stateDir) {
  const paths = runtimePaths(stateDir)
  return {
    ...paths,
    installed: fs.existsSync(paths.entry) && fs.existsSync(paths.clientDist),
  }
}
