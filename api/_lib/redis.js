const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// El cliente de Upstash solo se carga cuando hay credenciales configuradas
const Redis = UPSTASH_URL && UPSTASH_TOKEN ? (await import('@upstash/redis')).Redis : null;

// Memoria solo para desarrollo local y pruebas. En Vercel NUNCA se usa.
class MemoryRedis {
  constructor() {
    this.d = new Map();
    this.x = new Map();
  }
  _g(k) {
    const e = this.x.get(k);
    if (e !== undefined && e <= Date.now()) {
      this.d.delete(k);
      this.x.delete(k);
    }
    return this.d.get(k);
  }
  _h(k) {
    let h = this._g(k);
    if (h === undefined) {
      h = {};
      this.d.set(k, h);
    }
    return h;
  }
  async get(k) {
    const v = this._g(k);
    return typeof v === 'string' ? v : null;
  }
  async set(k, v, o = {}) {
    if (o.nx && this._g(k) !== undefined) return null;
    this.d.set(k, String(v));
    if (o.ex) this.x.set(k, Date.now() + o.ex * 1000);
    else this.x.delete(k);
    return 'OK';
  }
  async del(...ks) {
    let n = 0;
    for (const k of ks) {
      if (this.d.delete(k)) n++;
      this.x.delete(k);
    }
    return n;
  }
  async incr(k) {
    const n = (Number(this._g(k)) || 0) + 1;
    this.d.set(k, String(n));
    return n;
  }
  async expire(k, s) {
    if (this._g(k) === undefined) return 0;
    this.x.set(k, Date.now() + s * 1000);
    return 1;
  }
  async ttl(k) {
    if (this._g(k) === undefined) return -2;
    const e = this.x.get(k);
    return e === undefined ? -1 : Math.max(0, Math.ceil((e - Date.now()) / 1000));
  }
  async hgetall(k) {
    const h = this._g(k);
    return h && typeof h === 'object' ? { ...h } : null;
  }
  async hset(k, o) {
    const h = this._h(k);
    for (const [f, v] of Object.entries(o)) h[f] = String(v);
    return Object.keys(o).length;
  }
  async hsetnx(k, f, v) {
    const h = this._h(k);
    if (f in h) return 0;
    h[f] = String(v);
    return 1;
  }
  async hincrby(k, f, n) {
    const h = this._h(k);
    const v = (Number(h[f]) || 0) + n;
    h[f] = String(v);
    return v;
  }
}

let client;

export function db() {
  if (client) return client;
  if (Redis) {
    // Sin deserialización automática: todo se guarda y lee como texto (evita que "1234" pase a número)
    const c = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN, automaticDeserialization: false });

    // Con automaticDeserialization:false, hgetall devuelve una lista plana ["campo","valor",...]
    // en vez de un objeto. Aquí se convierte a objeto (o null si la clave no existe).
    const rawHgetall = c.hgetall.bind(c);
    c.hgetall = async (k) => {
      const r = await rawHgetall(k);
      if (!Array.isArray(r)) return r;
      if (!r.length) return null;
      const o = {};
      for (let i = 0; i < r.length; i += 2) o[r[i]] = r[i + 1];
      return o;
    };

    client = c;
  } else if (!process.env.VERCEL) {
    console.warn('[dev] Base de datos en memoria (no persistente).');
    client = new MemoryRedis();
  } else {
    throw new Error('Base de datos no configurada: faltan las variables de Upstash Redis.');
  }
  return client;
}
