import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { fail } from '../utils/response';

export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return fail(res, err.status, err.message, err.code);
  }
  console.error('Unhandled error:', err);
  return fail(res, 500, 'Internal server error', 'INTERNAL_ERROR');
}
