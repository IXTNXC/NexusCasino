import { randomInt, randomUUID } from 'node:crypto';
import { api, send } from './_lib/http.js';
import { HttpError } from './_lib/errors.js';
import { db } from './_lib/redis.js';
import { cleanBets, colorOf, payout } from './_lib/roulette.js';
import { tierForUser } from './_lib/nft.js';

// El resultado lo decide SIEMPRE el servidor (RNG criptográfico). El navegador solo anima.
export default api({ methods: ['POST'], auth: true, limit: { key: 'spin', max: 60, windowSec: 60 } }, async ({ res, body, session }) => {
  const { name, user } = session;
  const { bets, total } = cleanBets(body.bets);
  const r = db();

  // Un solo giro a la vez por cuenta (evita carreras y doble gasto)
  const lockKey = `lock:${name}`;
  const lockId = randomUUID();
  if (!(await r.set(lockKey, lockId, { nx: true, ex: 10 }))) {
    throw new HttpError(429, 'Hay un giro en curso. Espera un instante.');
  }

  try {
    // Se consulta el beneficio NFT antes de tocar el saldo; si falla, se juega sin cashback
    let tier = null;
    try {
      tier = await tierForUser(name, user.wallet);
    } catch {
      tier = null;
    }

    // Débito atómico: si el saldo queda negativo, se revierte y se rechaza
    const afterDebit = await r.hincrby(`u:${name}`, 'bal', -total);
    if (afterDebit < 0) {
      await r.hincrby(`u:${name}`, 'bal', total);
      throw new HttpError(400, 'Saldo insuficiente.');
    }

    const number = randomInt(0, 37); // 0-36, sin sesgo
    const win = payout(bets, number);
    const net = win - total;
    const cashback = net < 0 && tier ? Math.floor((-net * tier.cashbackPct) / 100) : 0;
    const credit = win + cashback;
    const balance = credit > 0 ? await r.hincrby(`u:${name}`, 'bal', credit) : afterDebit;

    send(res, 200, { number, color: colorOf(number), bet: total, win, net, cashback, balance, tier: tier ? tier.name : null });
  } finally {
    if ((await r.get(lockKey)) === lockId) await r.del(lockKey);
  }
});
