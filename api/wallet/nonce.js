import { randomBytes } from 'node:crypto';
import { api, send } from '../_lib/http.js';
import { HttpError } from '../_lib/errors.js';
import { db } from '../_lib/redis.js';

// Paso 1 de vincular wallet: el servidor genera un mensaje único (nonce) que la wallet debe firmar
export default api({ methods: ['POST'], auth: true, limit: { key: 'nonce', max: 10, windowSec: 300 } }, async ({ res, body, session }) => {
  const { isAddress } = await import('ethers');
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!isAddress(address)) throw new HttpError(400, 'Dirección de wallet no válida.');

  const nonce = randomBytes(16).toString('hex');
  const message =
    `NEXUS Casino\n\n` +
    `Vincular esta wallet a la cuenta "${session.user.name}".\n` +
    `Wallet: ${address}\n` +
    `Nonce: ${nonce}\n\n` +
    `Firmar este mensaje es gratis y no da acceso a tus fondos.`;

  await db().set(`nonce:${session.name}`, JSON.stringify({ message, address: address.toLowerCase() }), { ex: 300 });
  send(res, 200, { message });
});
