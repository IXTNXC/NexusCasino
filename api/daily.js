import { api, send } from './_lib/http.js';
import { HttpError } from './_lib/errors.js';
import { db } from './_lib/redis.js';
import { nftCountForUser } from './_lib/nft.js';
import { BASE_DAILY, tierFor } from './_lib/config.js';

function waitText(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.ceil((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// Bono diario: mayor si la wallet vinculada tiene NFT
export default api({ methods: ['POST'], auth: true, limit: { key: 'daily', max: 20, windowSec: 60 } }, async ({ res, session }) => {
  const { name, user } = session;
  // Primero se verifica el NFT: si la red falla no se gasta el bono del día
  const tier = tierFor(await nftCountForUser(name, user.wallet));

  const key = `daily:${name}`;
  const ok = await db().set(key, '1', { nx: true, ex: 86400 });
  if (!ok) {
    const ttl = await db().ttl(key);
    throw new HttpError(429, `Ya reclamaste tu bono. Vuelve en ${waitText(Math.max(ttl, 60))}.`);
  }

  const amount = tier ? tier.dailyBonus : BASE_DAILY;
  const balance = await db().hincrby(`u:${name}`, 'bal', amount);
  send(res, 200, { amount, balance, tier: tier ? tier.name : null });
});
