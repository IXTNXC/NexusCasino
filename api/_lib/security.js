import { db } from './redis.js';

export function clientIp(req) {
  const h = req.headers;
  const ip = h['x-real-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  return String(ip).trim().slice(0, 64);
}

// Ventana fija: no puede dejar claves sin caducidad ni bloquear para siempre.
export async function rateLimit(bucket, max, windowSec) {
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${bucket}:${slot}`;
  const n = await db().incr(key);
  await db().expire(key, windowSec * 2);
  return n <= max;
}

// Defensa CSRF: las peticiones que modifican datos deben venir de nuestro propio origen.
export function sameOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return req.headers['sec-fetch-site'] === 'same-origin';
}
