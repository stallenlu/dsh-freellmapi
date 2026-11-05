import type { Db } from '../db/types.js';
import type { Scheduler } from '../lib/scheduler.js';
export declare const AUTO_DUMP_SOURCES: ReadonlySet<string>;
export declare function getAutoDumpRetention(): number;
export declare const BACKUP_SOURCES: readonly ["manual", "scheduled", "pre-restore", "pre-update"];
export type BackupSource = (typeof BACKUP_SOURCES)[number];
export interface BackupSchedule {
    enabled: boolean;
    /** Local wall-clock time, HH:mm. */
    time: string;
    /** Minimum days between automatic backups. */
    intervalDays: number;
    /** Optional sub-directory of the database directory; '' means <db-dir>/backups. */
    backupPath: string;
}
export interface BackupMeta {
    id: number;
    filename: string;
    filesize: number;
    isFull: boolean;
    source: BackupSource;
    createdAt: string;
    tables: string[];
}
export declare function isExcludedTable(name: string): boolean;
/** Every table a dump may contain, in a stable order. */
export declare function listTables(db?: Db): string[];
/** Resolve (and create) the directory a dump is written to. `override` is
 *  interpreted relative to the database directory and may not escape it:
 *  an operator-supplied path is otherwise an arbitrary-write primitive, and
 *  `..`, an absolute path or a symlink out of the tree would all take it
 *  there. Both the lexical path and — once the directory exists — its real
 *  path are checked, so a symlink planted inside the data directory does not
 *  widen the hole. */
export declare function resolveBackupDir(db: Db, override?: string): string;
/** Validation hook for the schedule route: reject a path the writer would
 *  refuse later, at the moment the operator types it. */
export declare function assertBackupPathAllowed(db: Db, backupPath: string): void;
export declare function readBackupSchedule(): BackupSchedule;
export declare function writeBackupSchedule(schedule: BackupSchedule): BackupSchedule;
/** Identity of the schema a dump was taken against: the number of applied
 *  migrations plus the latest filename. Restoring a dump into a database at a
 *  different schema silently drops columns added since, or fails halfway; the
 *  header lets restore refuse instead. */
export declare function schemaVersion(db: Db): string;
export declare function createBackup(db: Db, opts?: {
    tables?: string[];
    source?: BackupSource;
    backupPath?: string;
}): BackupMeta;
/**
 * Bound the pile of automatic dumps (#1675).
 *
 * The scheduler and the desktop updater append a full dump each and nothing
 * removed them, so disk usage grew forever (the reporter's `backups/` held
 * 60-70 MB per app update). Keeps the newest `AUTO_BACKUP_DUMP_RETENTION`
 * auto dumps per source-agnostic count; `0` keeps every dump (opt-out).
 * Manual and pre-restore dumps are never touched: one is operator intent,
 * the other is the only undo for a restore.
 *
 * Deleting the row reuses deleteBackup's path re-check (a stale or hand-edited
 * row may point outside the data directory; that dump is left alone rather
 * than unlinking an arbitrary file) — so a dump whose file is already gone
 * still loses its index row, which is the half that mattered for the listing.
 */
export declare function pruneAutoDumps(db: Db, keep?: number): number;
export declare function listBackups(db: Db, opts?: {
    page?: number;
    pageSize?: number;
}): {
    items: BackupMeta[];
    total: number;
};
export declare function getBackupFile(db: Db, id: number): {
    path: string;
    filename: string;
};
export declare function deleteBackup(db: Db, id: number): void;
export interface RestoreResult {
    backup: BackupMeta;
    /** Dump of the pre-restore state, written before anything was changed. */
    snapshot: BackupMeta;
}
export declare function restoreBackup(db: Db, id: number): RestoreResult;
export declare function startBackupScheduler(scheduler: Scheduler): () => void;
//# sourceMappingURL=backups.d.ts.map