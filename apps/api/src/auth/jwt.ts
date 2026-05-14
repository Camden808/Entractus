import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  ttlSeconds: number,
): string {
  return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

export function signRefreshToken(
  payload: RefreshTokenPayload,
  secret: string,
  ttlSeconds: number,
): string {
  return jwt.sign(payload, secret, { expiresIn: ttlSeconds });
}

// Verified payloads include the standard jwt claims (iat/exp). Callers
// downcast as needed.
export interface VerifiedRefreshPayload extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

export function verifyRefreshToken(token: string, secret: string): VerifiedRefreshPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  if (typeof decoded.sub !== 'string' || typeof decoded.jti !== 'string') {
    throw new jwt.JsonWebTokenError('Malformed refresh token payload');
  }
  if (typeof decoded.iat !== 'number' || typeof decoded.exp !== 'number') {
    throw new jwt.JsonWebTokenError('Missing iat/exp on refresh token');
  }
  return {
    sub: decoded.sub,
    jti: decoded.jti,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

// Re-export jsonwebtoken's error types so route handlers can do
// `err instanceof JwtError` without importing the lib directly.
export const JsonWebTokenError = jwt.JsonWebTokenError;
export const TokenExpiredError = jwt.TokenExpiredError;
