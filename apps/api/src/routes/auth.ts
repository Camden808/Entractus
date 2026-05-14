import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { verifyRefreshToken, JsonWebTokenError, TokenExpiredError } from '../auth/jwt.js';
import { issueSession, clearRefreshCookie } from '../auth/session.js';
import { generateResetToken, hashResetToken } from '../auth/tokens.js';
import type { Mailer } from '../mail/mailer.js';

export interface AuthRouterOptions {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  passwordResetTtlSeconds: number;
  isProduction: boolean;
  mailer: Mailer;
  webBaseUrl: string;
}

// bcrypt silently truncates at 72 bytes; cap min length at 8 (common floor).
const registerSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(72),
  company: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

// Login doesn't enforce a length floor — a legacy user with an 8-char password
// shouldn't be locked out if we ever change the registration minimum. We still
// cap at 72 because bcrypt does.
const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(72),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(72),
});

export function createAuthRouter(opts: AuthRouterOptions): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { email, password, company, displayName, timezone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'email_taken' });
    }

    const passwordHash = await hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          company: company ?? null,
          displayName: displayName ?? null,
          timezone: timezone ?? 'UTC',
        },
        select: {
          id: true,
          email: true,
          company: true,
          displayName: true,
          timezone: true,
          role: true,
          createdAt: true,
        },
      });

      const accessToken = issueSession(res, user, opts);
      return res.status(201).json({ user, accessToken });
    } catch (err) {
      // Race condition: another request created the email between findUnique
      // and create. Prisma surfaces this as P2002 on the unique constraint.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'email_taken' });
      }
      throw err;
    }
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        company: true,
        displayName: true,
        timezone: true,
        role: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    // Generic message for both "unknown email" and "wrong password" so we
    // don't leak which accounts exist. Note: this still has a small timing
    // side-channel because we skip bcrypt.compare when the user is missing.
    // Acceptable tradeoff for now; revisit if/when enumeration becomes a
    // real concern.
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const { passwordHash: _passwordHash, ...userPublic } = user;
    const accessToken = issueSession(res, user, opts);
    return res.json({ user: userPublic, accessToken });
  });

  router.post('/refresh', async (req, res) => {
    const cookieToken = req.cookies?.refresh_token as string | undefined;
    if (!cookieToken) {
      return res.status(401).json({ error: 'no_refresh_token' });
    }

    // 1. Verify the JWT (signature + expiry + payload shape).
    let payload;
    try {
      payload = verifyRefreshToken(cookieToken, opts.jwtRefreshSecret);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        clearRefreshCookie(res, opts);
        return res.status(401).json({ error: 'refresh_token_expired' });
      }
      if (err instanceof JsonWebTokenError) {
        clearRefreshCookie(res, opts);
        return res.status(401).json({ error: 'invalid_refresh_token' });
      }
      throw err;
    }

    // 2. Reject if this jti has been revoked.
    const revoked = await prisma.revokedRefreshToken.findUnique({
      where: { jti: payload.jti },
    });
    if (revoked) {
      clearRefreshCookie(res, opts);
      return res.status(401).json({ error: 'refresh_token_revoked' });
    }

    // 3. Look up the user — they may have been deleted since the token was issued.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) {
      clearRefreshCookie(res, opts);
      return res.status(401).json({ error: 'invalid_refresh_token' });
    }

    // 4. Revoke the old jti (rotation), then issue a fresh session.
    await prisma.revokedRefreshToken.create({
      data: {
        jti: payload.jti,
        userId: user.id,
        expiresAt: new Date(payload.exp * 1000),
      },
    });

    const accessToken = issueSession(res, user, opts);
    return res.json({ accessToken });
  });

  router.post('/logout', async (req, res) => {
    const cookieToken = req.cookies?.refresh_token as string | undefined;

    // Always clear the cookie + return 204. Logout is idempotent: a stale or
    // tampered cookie is still "logged out" from the client's perspective.
    clearRefreshCookie(res, opts);

    if (cookieToken) {
      try {
        const payload = verifyRefreshToken(cookieToken, opts.jwtRefreshSecret);
        // Best-effort revoke. If the jti is already in the table (logout twice,
        // or this races refresh), Prisma raises P2002 and we swallow it.
        try {
          await prisma.revokedRefreshToken.create({
            data: {
              jti: payload.jti,
              userId: payload.sub,
              expiresAt: new Date(payload.exp * 1000),
            },
          });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
            throw err;
          }
        }
      } catch (err) {
        // Expired or malformed token — nothing useful to revoke. The cookie
        // is already cleared, so the client is effectively logged out.
        if (!(err instanceof JsonWebTokenError)) {
          throw err;
        }
      }
    }

    return res.status(204).send();
  });

  router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Only act when the user exists, but always return the same 202 so the
    // endpoint doesn't leak whether an email is registered.
    if (user) {
      const rawToken = generateResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + opts.passwordResetTtlSeconds * 1000);

      await prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt },
      });

      const resetUrl = `${opts.webBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await opts.mailer.sendPasswordReset({
        to: user.email,
        resetUrl,
        ttlMinutes: Math.round(opts.passwordResetTtlSeconds / 60),
      });
    }

    return res.status(202).json({ status: 'accepted' });
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { token, password } = parsed.data;
    const tokenHash = hashResetToken(token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    // Single bucket of "the token isn't usable" — covers unknown, used,
    // and expired alike so we don't leak which case it was.
    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_or_expired_token' });
    }

    const passwordHash = await hashPassword(password);

    // Atomically: rotate the password hash AND burn the token. If either
    // half fails the other is rolled back, so a token can't be marked used
    // without the password actually changing.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({ status: 'ok' });
  });

  return router;
}
