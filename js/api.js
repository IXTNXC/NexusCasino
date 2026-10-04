// Cliente HTTP común. Las cookies de sesión (HttpOnly) las gestiona el navegador; el JS nunca las ve.
export async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw Object.assign(new Error('Sin conexión con el servidor.'), { status: 0 });
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error del servidor.'), { status: res.status });
  return data;
}

export const fmt = (n) => Number(n).toLocaleString('es-ES');

export const GAME_URL = '/juego%20ruleta/roulette.html';
