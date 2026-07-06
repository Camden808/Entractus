import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { signAccessToken, signRefreshToken } from './jwt.js';

// Subset of AuthRouterOptions that's relevant to session issuance.
// Lives here (not routes/auth.ts) so routes/employer.ts can issue
// sessions with the exact same cookie semantics.
export interface IssueSessionOptions {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  isProduction: boolean;
}

// Cookie attributes shared by issue + clear (they must match for the browser
// to overwrite/clear the cookie). In production the web app and API live on
// different registrable domains (e.g. *.vercel.app <-> *.up.railway.app), so
// the refresh cookie must be SameSite=None; Secure or the browser won't send
// it on cross-site requests. Locally we use Lax (Secure can't be set over
// http://localhost).
function refreshCookieOptions(opts: IssueSessionOptions) {
  return {
    httpOnly: true,
    secure: opts.isProduction,
    sameSite: (opts.isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/api/auth',
  };
}

export function issueSession(
  res: Response,
  user: { id: string; role: UserRole },
  opts: IssueSessionOptions,
): string {
  const accessToken = signAccessToken(
    { sub: user.id, role: user.role },
    opts.jwtAccessSecret,
    opts.accessTokenTtlSeconds,
  );
  const refreshToken = signRefreshToken(
    { sub: user.id, jti: randomUUID() },
    opts.jwtRefreshSecret,
    opts.refreshTokenTtlSeconds,
  );

  res.cookie('refresh_token', refreshToken, {
    ...refreshCookieOptions(opts),
    maxAge: opts.refreshTokenTtlSeconds * 1000,
  });

  return accessToken;
}

export function clearRefreshCookie(res: Response, opts: IssueSessionOptions): void {
  res.clearCookie('refresh_token', refreshCookieOptions(opts));
}
