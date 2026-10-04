import { HttpError } from './errors.js';
import { db } from './redis.js';
import { tierFor } from './config.js';

const ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

export const nftConfigured = () => Boolean(process.env.RPC_URL && process.env.NFT_CONTRACT_ADDRESS);

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function readOnChain(address) {
  const { JsonRpcProvider, Contract } = await import('ethers');
  const chainId = Number(process.env.CHAIN_ID || 1);
  const provider = new JsonRpcProvider(process.env.RPC_URL, chainId, { staticNetwork: true });
  try {
    const c = new Contract(process.env.NFT_CONTRACT_ADDRESS, ABI, provider);
    const is1155 = process.env.NFT_STANDARD === '1155';
    const bal = is1155
      ? await withTimeout(c['balanceOf(address,uint256)'](address, BigInt(process.env.NFT_TOKEN_ID || 0)), 6000)
      : await withTimeout(c['balanceOf(address)'](address), 6000);
    return Number(bal);
  } finally {
    provider.destroy();
  }
}

// Cantidad de NFT que tiene la wallet vinculada (caché 5 min). Lanza 503 si no se puede verificar.
export async function nftCountForUser(nameLower, wallet) {
  if (!wallet || !nftConfigured()) return 0;
  const key = `nft:${nameLower}`;
  const cached = await db().get(key);
  if (cached !== null) return Number(cached) || 0;
  try {
    const count = await readOnChain(wallet);
    await db().set(key, String(count), { ex: 300 });
    return count;
  } catch (e) {
    console.error('[nft] fallo RPC:', e.message);
    throw new HttpError(503, 'No se pudo verificar tus NFT ahora mismo. Inténtalo de nuevo en un momento.');
  }
}

export async function tierForUser(nameLower, wallet) {
  return tierFor(await nftCountForUser(nameLower, wallet));
}
