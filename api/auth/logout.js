import { api, send } from '../_lib/http.js';
import { db } from '../_lib/redis.js';
import { clearSessionCookie, getSession } from '../_lib/session.js';

// Cerrar sesión invalida TODAS las sesiones de la cuenta (sube la versión de sesión)
export default api({ methods: ['POST'] }, async ({ req, res }) => {
  const s = await getSession(req);
  if (s) await db().hincrby(`u:${s.name}`, 'sv', 1);
  clearSessionCookie(req, res);
  send(res, 200, { ok: true });
});
