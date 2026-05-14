import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

// Augments Express's Request so `req.user` is typed everywhere this
// middleware has run.
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export interface RequireAuthOptions {
  jwtAccessSecret: string;
}

export function requireAuth({ jwtAccessSecret }: RequireAuthOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'missing_access_token' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'missing_access_token' });
    }

    try {
      const decoded = jwt.verify(token, jwtAccessSecret) as jwt.JwtPayload;
      const role = decoded.role as UserRole | undefined;
      if (typeof decoded.sub !== 'string' || (role !== 'user' && role !== 'admin')) {
        return res.status(401).json({ error: 'invalid_access_token' });
      }
      req.user = { id: decoded.sub, role };
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'access_token_expired' });
      }
      if (err instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'invalid_access_token' });
      }
      throw err;
    }
  };
}

// Convenience wrapper for routes that require an admin. Use AFTER requireAuth
// in the chain (or pair them with the same options).
export function requireAdmin(): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'missing_access_token' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
}
