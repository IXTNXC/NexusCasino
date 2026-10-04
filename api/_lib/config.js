// Configuración central del casino NEXUS

export const SESSION_COOKIE = 'nexus_session';
export const SESSION_TTL_SEC = 60 * 60 * 12; // 12 horas

export const START_BALANCE = 1000; // saldo de bienvenida (créditos de juego)
export const BASE_DAILY = 100; // bono diario sin NFT

export const LIMITS = {
  minBet: 1,
  maxTotal: 10000, // apuesta total máxima por giro
  maxPositions: 60,
};

// Beneficios por cantidad de NFT en la wallet vinculada
export const TIERS = [
  { id: 'holder', name: 'Holder', min: 1, dailyBonus: 500, cashbackPct: 2 },
  { id: 'vip', name: 'VIP', min: 5, dailyBonus: 2500, cashbackPct: 5 },
  { id: 'whale', name: 'Whale', min: 20, dailyBonus: 10000, cashbackPct: 10 },
];

export function tierFor(count) {
  let found = null;
  for (const t of TIERS) if (count >= t.min) found = t;
  return found;
}

export const publicTier = (t) => ({
  id: t.id,
  name: t.name,
  min: t.min,
  dailyBonus: t.dailyBonus,
  cashbackPct: t.cashbackPct,
});
