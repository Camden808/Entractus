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
    httpOnly: true,
    secure: opts.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: opts.refreshTokenTtlSeconds * 1000,
  });

  return accessToken;
}

export function clearRefreshCookie(res: Response, opts: IssueSessionOptions): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: opts.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
  });
}
