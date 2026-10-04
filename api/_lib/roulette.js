import { HttpError } from './errors.js';
import { LIMITS } from './config.js';

export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

// id -> [condición, pago] (el pago no incluye la apuesta devuelta)
const RULES = {
  low: [(n) => n >= 1 && n <= 18, 1],
  high: [(n) => n >= 19 && n <= 36, 1],
  even: [(n) => n > 0 && n % 2 === 0, 1],
  odd: [(n) => n % 2 === 1, 1],
  red: [(n) => REDS.has(n), 1],
  black: [(n) => n > 0 && !REDS.has(n), 1],
  d1: [(n) => n >= 1 && n <= 12, 2],
  d2: [(n) => n >= 13 && n <= 24, 2],
  d3: [(n) => n >= 25 && n <= 36, 2],
  c1: [(n) => n > 0 && n % 3 === 1, 2],
  c2: [(n) => n > 0 && n % 3 === 2, 2],
  c3: [(n) => n > 0 && n % 3 === 0, 2],
};

const STRAIGHT_RE = /^n(?:[0-9]|[12][0-9]|3[0-6])$/;
const isValidId = (id) => STRAIGHT_RE.test(id) || Object.hasOwn(RULES, id);

// Valida y normaliza las apuestas que llegan del cliente (nunca se confía en el navegador)
export function cleanBets(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'Apuestas inválidas.');
  const entries = Object.entries(raw);
  if (entries.length === 0) throw new HttpError(400, 'Coloca al menos una apuesta.');
  if (entries.length > LIMITS.maxPositions) throw new HttpError(400, 'Demasiadas posiciones de apuesta.');
  const bets = Object.create(null);
  let total = 0;
  for (const [id, amt] of entries) {
    if (!isValidId(id)) throw new HttpError(400, 'Apuesta no reconocida.');
    if (!Number.isSafeInteger(amt) || amt < LIMITS.minBet || amt > LIMITS.maxTotal) {
      throw new HttpError(400, 'Importe de apuesta inválido.');
    }
    bets[id] = amt;
    total += amt;
  }
  if (total > LIMITS.maxTotal) throw new HttpError(400, `La apuesta máxima por giro es ${LIMITS.maxTotal}.`);
  return { bets, total };
}

export function betWins(id, n) {
  if (STRAIGHT_RE.test(id)) return Number(id.slice(1)) === n;
  return RULES[id][0](n);
}

// Devuelve lo que se abona al jugador (apuesta ganadora devuelta + premio)
export function payout(bets, n) {
  let win = 0;
  for (const [id, amt] of Object.entries(bets)) {
    if (!betWins(id, n)) continue;
    win += STRAIGHT_RE.test(id) ? amt * 36 : amt * (RULES[id][1] + 1);
  }
  return win;
}
