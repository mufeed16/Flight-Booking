import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { fail } from './response';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return fail(res, 400, result.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR');
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return fail(res, 400, result.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR');
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}
