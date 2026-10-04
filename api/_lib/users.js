import { db } from './redis.js';

export async function getUser(nameLower) {
  const h = await db().hgetall(`u:${nameLower}`);
  if (!h || !h.name) return null;
  return { ...h, key: nameLower, bal: Number(h.bal) || 0, sv: Number(h.sv) || 0 };
}

export const publicUser = (u) => ({
  name: u.name,
  balance: u.bal,
  wallet: u.wallet || null,
  createdAt: Number(u.created) || null,
});
