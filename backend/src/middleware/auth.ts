import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { fail } from '../utils/response';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return fail(res, 401, 'Missing or invalid Authorization header', 'UNAUTHENTICATED');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload: any = jwt.verify(token, config.jwt.accessSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    return fail(res, 401, 'Invalid or expired access token', 'UNAUTHENTICATED');
  }
}

export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, 'Unauthenticated', 'UNAUTHENTICATED');
    if (req.user.role !== role) return fail(res, 403, 'Forbidden', 'FORBIDDEN');
    next();
  };
}
