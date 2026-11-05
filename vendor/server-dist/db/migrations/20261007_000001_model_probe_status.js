export function up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS model_probe_status (
    platform TEXT NOT NULL,
    model_id TEXT NOT NULL,
    endpoint_scope TEXT,
    key_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_probed_at TEXT,
    last_error TEXT,
    latency_ms INTEGER,
    PRIMARY KEY (platform, model_id, endpoint_scope, key_id)
  )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_model_probe_status_probed_at
    ON model_probe_status(last_probed_at)`);
}
export function down(db) {
    db.exec('DROP TABLE IF EXISTS model_probe_status');
}
//# sourceMappingURL=20261007_000001_model_probe_status.js.map