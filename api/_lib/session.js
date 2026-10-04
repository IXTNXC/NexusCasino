import { SignJWT, jwtVerify } from 'jose';
import { SESSION_COOKIE, SESSION_TTL_SEC } from './config.js';
import { getUser } from './users.js';

function secret() {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (!process.env.VERCEL) return new TextEncoder().encode('dev-only-secret-change-me-0123456789abcdef');
  throw new Error('JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres).');
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const isHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function cookie(req, value, maxAge) {
  const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export async function issueSession(req, res, nameLower, sessionVersion) {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(nameLower)
    .setIssuer('nexus')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret());
  res.setHeader('Set-Cookie', cookie(req, token, SESSION_TTL_SEC));
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', cookie(req, '', 0));
}

// Devuelve { name, user } o null. La versión de sesión permite invalidar todas las sesiones al cerrar sesión.
export async function getSession(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'nexus', algorithms: ['HS256'] });
    if (!payload.sub) return null;
    const user = await getUser(payload.sub);
    if (!user || user.sv !== Number(payload.sv)) return null;
    return { name: payload.sub, user };
  } catch {
    return null;
  }
}
