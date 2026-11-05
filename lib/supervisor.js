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
    if (await this.reachable()) {
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
        this.startedAt = 0
        this.lastError = `the server exited with ${signal !== null ? `signal ${signal}` : `code ${code}`}`
        this.logger?.warn?.(`dsh-freellmapi: ${this.lastError}`)
      }
    })

    const deadline = Date.now() + STARTUP_GRACE_MS
    for (;;) {
      if (await this.reachable(800)) {
        this.logger?.info?.(`dsh-freellmapi: router listening after ${Date.now() - this.startedAt} ms`)
        if (hooks.onKey !== undefined) await this.reportKey(hooks.onKey)
        return { started: true, alreadyRunning: false, ...this.status() }
      }
      if (child.exitCode !== null) {
        throw new Error(
          `the bundled server exited with code ${child.exitCode} before the router answered${this.tailForError()}`,
        )
      }
      if (Date.now() > deadline) {
        throw new Error(
          `the router did not answer within ${Math.round(STARTUP_GRACE_MS / 1000)} s${this.tailForError()}`,
        )
      }
      await sleep(500)
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
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
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
