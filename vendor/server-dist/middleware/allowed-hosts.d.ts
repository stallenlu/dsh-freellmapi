import type { Request, Response, NextFunction } from 'express';
/**
 * Express middleware enforcing the Host allowlist.
 * @param allowed raw host patterns from ALLOWED_HOSTS (empty → guard off). Exact, case-insensitive hostnames; a single `*` disables the
 *  guard. `*.example.com` entries match any single-label subdomain wildcard
 *  is NOT supported — name every host you serve.
 */
export declare function createHostGuard(allowed: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=allowed-hosts.d.ts.map