import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { ok, fail } from '../../utils/response';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const { email, password, fullName } = req.body as z.infer<typeof registerSchema>;
  const tokens = await authService.register(email, password, fullName);
  return ok(res, tokens);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const tokens = await authService.login(email, password);
  return ok(res, tokens);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
  const tokens = await authService.rotateRefresh(refreshToken);
  return ok(res, tokens);
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
  if (!refreshToken) return fail(res, 400, 'refreshToken required', 'VALIDATION_ERROR');
  await authService.logout(refreshToken);
  return ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  return ok(res, { user: req.user });
}
