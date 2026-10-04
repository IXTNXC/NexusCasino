export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function str(v, max = 256) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function validEmail(e) {
  return e.length <= 254 && EMAIL_RE.test(e);
}

// 8-72 bytes (límite de bcrypt), con letras y números
export function validPassword(p) {
  return typeof p === 'string' && p.length >= 8 && Buffer.byteLength(p) <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

// Devuelve la edad en años o null si la fecha no es válida
export function ageFrom(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  const n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
