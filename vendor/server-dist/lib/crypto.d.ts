import type { Db } from '../db/types.js';
/**
 * Initialize encryption key from env or an explicit local-dev fallback.
 * Must be called after DB is initialized.
 *
 * Precedence (dev fallback): ENCRYPTION_KEY env > existing key file next to the
 * DB > legacy `settings` table row (migrated to the file, then deleted) >
 * freshly generated key written to the file.
 */
export declare function initEncryptionKey(db: Db): void;
/**
 * A short, non-reversible identifier for the key currently in use.
 *
 * Database dumps record it in their header so a restore can tell, before it
 * touches a row, whether the api_keys ciphertext in the file was written under
 * this key. sha256 truncated to 64 bits: enough to catch a different key,
 * nowhere near enough to help recover the key itself, and safe to show in an
 * error message or write to a file an operator emails around.
 *
 * Returns null before initEncryptionKey() has run.
 */
export declare function encryptionKeyFingerprint(): string | null;
export declare function isEncryptionKeyInitialized(): boolean;
export declare function encrypt(text: string): {
    encrypted: string;
    iv: string;
    authTag: string;
};
export declare function decrypt(encrypted: string, iv: string, authTag: string): string;
/**
 * Whether the loaded key can open the secrets already stored in this database.
 *
 * A key file that exists but no longer matches the ciphertext is a silent
 * disaster: every `api_keys` row fails GCM authentication, so the health checks
 * report one platform at a time as broken with "Unsupported state or unable to
 * authenticate data", and the router ends up with no usable key. Nothing in that
 * output says the key file is the problem. Probing one row at boot turns the
 * whole class into a single accurate diagnosis.
 *
 * The mismatch is easy to reach: appdata is portable, so copying a database
 * between installs while keeping the older `.encryption-key` (or restoring from
 * a backup that carries its own) produces exactly this state.
 *
 * Returns null when there is nothing to check: no key init yet, no `api_keys`
 * table, or no stored secret.
 */
export declare function probeStoredSecrets(db: Db): boolean | null;
export declare function maskKey(key: string): string;
//# sourceMappingURL=crypto.d.ts.map