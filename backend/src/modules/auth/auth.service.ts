import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../../db/pool';
import { config } from '../../config';
import { HttpError } from '../../utils/errors';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'user' | 'admin';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function signAccess(user: { id: number; email: string; role: string }) {
  const opts: SignOptions = { expiresIn: config.jwt.accessTtl as any };
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.accessSecret,
    opts
  );
}

function signRefresh(user: { id: number; email: string; role: string }) {
  const opts: SignOptions = { expiresIn: config.jwt.refreshTtl as any };
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, typ: 'refresh' },
    config.jwt.refreshSecret,
    opts
  );
}

function refreshExpiry(): Date {
  // Parse "7d" / "15m" style TTL into a Date.
  const ttl = config.jwt.refreshTtl;
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const n = Number(m[1]);
  const unit = m[2];
  const ms =
    unit === 's' ? n * 1000 :
    unit === 'm' ? n * 60 * 1000 :
    unit === 'h' ? n * 3600 * 1000 :
    n * 24 * 3600 * 1000;
  return new Date(Date.now() + ms);
}

export async function register(email: string, password: string, fullName: string) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new HttpError(409, 'Email already registered', 'EMAIL_TAKEN');
  }
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, email, password_hash, full_name, role`,
    [email, hash, fullName]
  );
  const user = result.rows[0];
  return issueTokens(user);
}

export async function login(email: string, password: string) {
  const result = await pool.query<UserRow>(
    'SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user) throw new HttpError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  return issueTokens(user);
}

async function issueTokens(user: UserRow): Promise<AuthTokens> {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, refreshExpiry()]
  );
  return { accessToken, refreshToken };
}

export async function rotateRefresh(refreshToken: string): Promise<AuthTokens> {
  let payload: any;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw new HttpError(401, 'Invalid refresh token', 'INVALID_REFRESH');
  }
  if (payload.typ !== 'refresh') {
    throw new HttpError(401, 'Invalid refresh token', 'INVALID_REFRESH');
  }
  const stored = await pool.query(
    'SELECT id, revoked FROM refresh_tokens WHERE token = $1',
    [refreshToken]
  );
  if (!stored.rowCount) throw new HttpError(401, 'Refresh token not recognised', 'INVALID_REFRESH');
  if (stored.rows[0].revoked) throw new HttpError(401, 'Refresh token revoked', 'INVALID_REFRESH');

  // Rotation: revoke the old token, issue a new pair.
  await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [stored.rows[0].id]);

  const userRes = await pool.query<UserRow>(
    'SELECT id, email, password_hash, full_name, role FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = userRes.rows[0];
  if (!user) throw new HttpError(401, 'User no longer exists', 'INVALID_REFRESH');
  return issueTokens(user);
}

export async function logout(refreshToken: string) {
  await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken]);
}
