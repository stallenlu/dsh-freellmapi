/**
 * Which providers need no API key, and how to give a fresh install their rows.
 *
 * The router will not route to a platform until `api_keys` holds a row for it,
 * even when that platform is anonymous. A new install therefore starts with
 * nothing enabled and the user has to open the dashboard and click "add" seven
 * times before the router answers at all. The bundled server already knows how
 * to fix that part on its own: its declarative config accepts a key with no
 * secret for a keyless platform and stores the `no-key` sentinel.
 *
 * The list of keyless platforms is read from the vendored provider registry
 * rather than written down here, so a platform that starts requiring (or stops
 * requiring) a key is picked up by the next release without touching this file.
 *
 * @module lib/keyless
 */

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

import { PACKAGE_ROOT } from './runtime.js'

let cached;

/**
 * Platform ids whose provider is anonymous (`keyless: true`).
 *
 * Importing the registry is cheap and side-effect free: it only assembles the
 * provider table. A failure is not fatal — the caller seeds nothing and the
 * router behaves exactly as it did before.
 */
export async function keylessPlatforms() {
  if (cached !== undefined) return cached
  try {
    const registry = await import(pathToFileURL(`${PACKAGE_ROOT}/vendor/server-dist/providers/index.js`).href)
    const all = registry.getAllProviders()
    cached = all
      .filter((provider) => provider?.keyless === true)
      .map((provider) => provider.platform)
      .filter((platform) => typeof platform === 'string' && platform !== '')
      .sort()
  } catch {
    cached = []
  }
  return cached
}

/**
 * Keyless platforms that have no `api_keys` row yet.
 *
 * A row that exists — enabled or not — means the user has already seen this
 * platform and decided. Re-adding it on every boot would undo that decision, so
 * only genuinely absent platforms are returned. A database that does not exist
 * yet (first boot) has no rows at all, which is the case this exists for.
 */
export async function missingKeylessPlatforms(dbPath, platforms) {
  if (platforms.length === 0) return []
  if (!fs.existsSync(dbPath)) return platforms
  let DatabaseSync
  try {
    ;({ DatabaseSync } = await import('node:sqlite'))
  } catch {
    // No sqlite in this runtime: leave the decision to the router itself.
    return []
  }
  let db
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const rows = db.prepare('SELECT DISTINCT platform FROM api_keys').all()
    const present = new Set(rows.map((row) => row.platform))
    return platforms.filter((platform) => !present.has(platform))
  } catch {
    // A database mid-migration has no such table yet; seeding nothing is safe
    // because the next start sees the finished schema.
    return []
  } finally {
    try {
      db?.close()
    } catch {
      // Closing a handle that may never have opened is not worth reporting.
    }
  }
}

/** A fresh install starts here: `{ platforms: [...], missing: [...] }`. */
export async function planKeylessSeed(dbPath) {
  const platforms = await keylessPlatforms()
  const missing = await missingKeylessPlatforms(dbPath, platforms)
  return { platforms, missing }
}
