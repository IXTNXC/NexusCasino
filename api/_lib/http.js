import { HttpError } from './errors.js';
import { clientIp, rateLimit, sameOrigin } from './security.js';
import { getSession } from './session.js';

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

// Envoltorio común de todos los endpoints: método, origen (CSRF), JSON, límite de tasa, sesión y errores.
export function api({ methods, auth = false, limit }, fn) {
  return async function handler(req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        return send(res, 405, { error: 'Método no permitido' });
      }

      const unsafe = req.method !== 'GET' && req.method !== 'HEAD';
      let body = {};
      if (unsafe) {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Origen no permitido' });
        if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
          return send(res, 415, { error: 'Se requiere application/json' });
        }
        if (Number(req.headers['content-length'] || 0) > 20000) return send(res, 413, { error: 'Solicitud demasiado grande' });
        try {
          body = req.body ?? {};
        } catch {
          return send(res, 400, { error: 'JSON inválido' });
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return send(res, 400, { error: 'Cuerpo inválido' });
        }
      }

      const ip = clientIp(req);
      if (limit && !(await rateLimit(`${limit.key}:${ip}`, limit.max, limit.windowSec))) {
        res.setHeader('Retry-After', String(limit.windowSec));
        return send(res, 429, { error: 'Demasiadas solicitudes. Espera un momento.' });
      }

      let session = null;
      if (auth) {
        session = await getSession(req);
        if (!session) return send(res, 401, { error: 'Sesión no válida' });
      }

      await fn({ req, res, body, ip, session });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error('[api]', req.url, e);
      return send(res, 500, { error: 'Error interno del servidor' });
    }
  };
}
