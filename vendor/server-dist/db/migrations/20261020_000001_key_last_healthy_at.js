// Migration: last_healthy_at observability column on api_keys (#1493)
// Created: 2026-10-20
//
// DOWN: reversible (DROP COLUMN)
//
// A key can sit at status='healthy' with a fresh last_checked_at while never
// actually working: the transport-error path in services/health.ts refreshes
// last_checked_at but records no success, so "checked recently" is
// indistinguishable from "worked recently" (#1493). last_healthy_at is written
// only on evidence that the key WORKED — a valid probe verdict or a served
// live request — and never on a transport error, so "last worked N ago" is
// readable straight off the key row.
//
// Guarded like every other column add: catalog-sync re-runs migrations over a
// live schema, so ALTERs must be idempotent.
function hasColumn(db, table, column) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(col => col.name === column);
}
export function up(db) {
    if (!hasColumn(db, 'api_keys', 'last_healthy_at')) {
        db.prepare('ALTER TABLE api_keys ADD COLUMN last_healthy_at TEXT').run();
    }
}
export function down(db) {
    if (hasColumn(db, 'api_keys', 'last_healthy_at')) {
        db.prepare('ALTER TABLE api_keys DROP COLUMN last_healthy_at').run();
    }
}
//# sourceMappingURL=20261020_000001_key_last_healthy_at.js.map