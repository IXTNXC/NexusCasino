import { api, send } from '../_lib/http.js';
import { nftConfigured, nftCountForUser } from '../_lib/nft.js';
import { BASE_DAILY, TIERS, publicTier, tierFor } from '../_lib/config.js';

export default api({ methods: ['GET'], auth: true, limit: { key: 'nft', max: 30, windowSec: 60 } }, async ({ res, session }) => {
  const { name, user } = session;
  const count = await nftCountForUser(name, user.wallet);
  const tier = tierFor(count);
  send(res, 200, {
    configured: nftConfigured(),
    collection: process.env.NFT_COLLECTION_NAME || 'tu colección NFT',
    wallet: user.wallet || null,
    count,
    tier: tier ? publicTier(tier) : null,
    tiers: TIERS.map(publicTier),
    baseDaily: BASE_DAILY,
  });
});
