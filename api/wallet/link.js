import { api, send } from '../_lib/http.js';
import { HttpError } from '../_lib/errors.js';
import { db } from '../_lib/redis.js';

const SIG_RE = /^0x[0-9a-fA-F]{130}$/;

// Paso 2: se verifica la firma. Solo quien controla la wallet puede vincularla.
export default api({ methods: ['POST'], auth: true, limit: { key: 'link', max: 10, windowSec: 300 } }, async ({ res, body, session }) => {
  const { verifyMessage, isAddress } = await import('ethers');
  const name = session.name;
  const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';
  const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
  if (!isAddress(address) || !SIG_RE.test(signature)) throw new HttpError(400, 'Datos de firma inválidos.');

  const raw = await db().get(`nonce:${name}`);
  if (!raw) throw new HttpError(400, 'La solicitud caducó. Vuelve a intentarlo.');
  await db().del(`nonce:${name}`); // un solo uso
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Solicitud corrupta. Vuelve a intentarlo.');
  }
  if (saved.address !== address) throw new HttpError(400, 'La wallet no coincide con la solicitud.');

  let recovered;
  try {
    recovered = verifyMessage(saved.message, signature).toLowerCase();
  } catch {
    throw new HttpError(400, 'Firma no válida.');
  }
  if (recovered !== address) throw new HttpError(401, 'La firma no corresponde a esa wallet.');

  const claimed = await db().set(`w:${address}`, name, { nx: true });
  if (!claimed && (await db().get(`w:${address}`)) !== name) {
    throw new HttpError(409, 'Esa wallet ya está vinculada a otra cuenta.');
  }

  const prev = session.user.wallet;
  if (prev && prev !== address) await db().del(`w:${prev}`);
  await db().hset(`u:${name}`, { wallet: address });
  await db().del(`nft:${name}`); // fuerza nueva lectura de NFT
  send(res, 200, { wallet: address });
});
