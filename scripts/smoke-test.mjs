// Test de humo del backend (usa la base de datos en memoria; no necesita Vercel ni Upstash)
// Ejecutar: npm test
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import register from '../api/auth/register.js';
import login from '../api/auth/login.js';
import logout from '../api/auth/logout.js';
import me from '../api/auth/me.js';
import spin from '../api/spin.js';
import daily from '../api/daily.js';
import nonce from '../api/wallet/nonce.js';
import link from '../api/wallet/link.js';
import nftStatus from '../api/nft/status.js';
import { cleanBets, payout, colorOf } from '../api/_lib/roulette.js';

let ipCounter = 10;
const nextIp = () => `10.0.0.${ipCounter++}`;

function call(handler, { method = 'POST', body, cookie, origin = 'http://localhost', ip = nextIp(), type = 'application/json' } = {}) {
  return new Promise((resolve) => {
    const headers = { host: 'localhost', 'x-forwarded-proto': 'http', 'x-real-ip': ip };
    if (type) headers['content-type'] = type;
    if (origin) headers.origin = origin;
    if (cookie) headers.cookie = cookie;
    const req = { method, headers, body, url: '/test', socket: { remoteAddress: ip } };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(data) { resolve({ status: this.statusCode, headers: this.headers, json: data ? JSON.parse(data) : null }); },
    };
    handler(req, res);
  });
}
const cookieOf = (r) => String(r.headers['set-cookie']).split(';')[0];

let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

const good = { username: 'Jugador1', email: 'j1@example.com', birth: '1990-05-10', password: 'Clave1234', terms: true };

console.log('Lógica de la ruleta');
assert.equal(colorOf(0), 'green'); assert.equal(colorOf(1), 'red'); assert.equal(colorOf(2), 'black');
assert.equal(payout(cleanBets({ n17: 10 }).bets, 17), 360); ok('pleno paga 35:1 (36x con apuesta)');
assert.equal(payout(cleanBets({ n17: 10 }).bets, 18), 0); ok('pleno fallido no paga');
assert.equal(payout(cleanBets({ red: 10 }).bets, 1), 20); ok('rojo paga 1:1');
assert.equal(payout(cleanBets({ red: 10 }).bets, 0), 0); ok('el 0 pierde las apuestas externas');
assert.equal(payout(cleanBets({ d2: 10 }).bets, 20), 30); ok('docena paga 2:1');
assert.equal(payout(cleanBets({ c1: 10 }).bets, 34), 30); assert.equal(payout(cleanBets({ c1: 10 }).bets, 3), 0); ok('columnas correctas');
assert.equal(payout(cleanBets({ even: 10, odd: 10 }).bets, 0), 0); ok('par/impar no cubre el 0');
for (const bad of [{ n37: 5 }, { __proto__x: 5 }, { red: -1 }, { red: 1.5 }, { red: '5' }, { red: 99999 }, {}, null, [], { n01: 1 }, { toString: 1 }, { constructor: 1 }]) {
  assert.throws(() => cleanBets(bad), `debería rechazar ${JSON.stringify(bad)}`);
}
ok('apuestas manipuladas rechazadas');

console.log('Registro y sesión');
let r = await call(register, { body: { ...good, birth: '2015-01-01' } });
assert.equal(r.status, 403); ok('menor de edad rechazado');
r = await call(register, { body: { ...good, password: 'corta' } });
assert.equal(r.status, 400); ok('contraseña débil rechazada');
r = await call(register, { body: { ...good, username: 'a b' } });
assert.equal(r.status, 400); ok('usuario inválido rechazado');
r = await call(register, { body: { ...good, terms: false } });
assert.equal(r.status, 400); ok('sin aceptar términos rechazado');
r = await call(register, { body: good, origin: 'https://evil.example' });
assert.equal(r.status, 403); ok('CSRF: origen ajeno rechazado');
r = await call(register, { body: good, type: 'text/plain' });
assert.equal(r.status, 415); ok('tipo de contenido no JSON rechazado');
r = await call(register, { body: good });
assert.equal(r.status, 201); assert.equal(r.json.user.balance, 1000);
assert.ok(String(r.headers['set-cookie']).includes('HttpOnly')); assert.ok(String(r.headers['set-cookie']).includes('SameSite=Strict'));
const cookie = cookieOf(r); ok('registro correcto con cookie HttpOnly + SameSite=Strict + saldo inicial');
assert.ok(!JSON.stringify(r.json).includes('hash')); ok('la respuesta no filtra el hash');
r = await call(register, { body: { ...good, email: 'otro@example.com', username: 'jugador1' } });
assert.equal(r.status, 409); ok('usuario duplicado (sin distinguir mayúsculas)');
r = await call(register, { body: { ...good, username: 'Otro', email: 'J1@example.com' } });
assert.equal(r.status, 409); ok('correo duplicado');

r = await call(login, { body: { username: 'jugador1', password: 'mala1234' } });
assert.equal(r.status, 401); ok('login con clave incorrecta');
r = await call(login, { body: { username: 'noexiste', password: 'Clave1234' } });
assert.equal(r.status, 401); ok('login con usuario inexistente (mismo error)');
r = await call(login, { body: { username: 'j1@example.com', password: 'Clave1234' } });
assert.equal(r.status, 200); ok('login con correo');
r = await call(me, { method: 'GET', cookie });
assert.equal(r.status, 200); assert.equal(r.json.user.name, 'Jugador1'); ok('/me con sesión válida');
r = await call(me, { method: 'GET' });
assert.equal(r.status, 401); ok('/me sin sesión → 401');
r = await call(me, { method: 'GET', cookie: 'nexus_session=eyJhbGciOiJub25lIn0.e30.' });
assert.equal(r.status, 401); ok('token falsificado rechazado');

console.log('Fuerza bruta');
for (let i = 0; i < 8; i++) await call(login, { body: { username: 'victima', password: 'x' + i } });
r = await call(login, { body: { username: 'victima', password: 'Clave1234' } });
assert.equal(r.status, 429); ok('límite por cuenta tras 8 intentos fallidos');
const ipFixed = '99.99.99.99'; let last;
for (let i = 0; i < 22; i++) last = await call(login, { body: { username: 'u' + i, password: 'x' }, ip: ipFixed });
assert.equal(last.status, 429); ok('límite por IP');

console.log('Giros');
r = await call(spin, { cookie, body: { bets: { red: 100 } } });
assert.equal(r.status, 200);
assert.ok(Number.isInteger(r.json.number) && r.json.number >= 0 && r.json.number <= 36);
const expectedWin = payout(cleanBets({ red: 100 }).bets, r.json.number);
assert.equal(r.json.balance, 1000 - 100 + expectedWin); ok('giro válido: saldo = 1000 - apuesta + premio');
r = await call(spin, { cookie, body: { bets: { red: 5000 } } });
assert.equal(r.status, 400); assert.match(r.json.error, /insuficiente/i); ok('saldo insuficiente rechazado');
r = await call(me, { method: 'GET', cookie });
assert.ok(r.json.user.balance >= 0); ok('el saldo nunca queda negativo tras rechazo');
r = await call(spin, { cookie, body: { bets: { n99: 5 } } });
assert.equal(r.status, 400); ok('apuesta inválida rechazada por el servidor');
r = await call(spin, { body: { bets: { red: 5 } } });
assert.equal(r.status, 401); ok('giro sin sesión → 401');
r = await call(spin, { cookie, body: { bets: { red: 1 }, number: 17 } });
assert.equal(r.status, 200); ok('campo "number" enviado por el cliente se ignora');

// Estadística básica: 3000 giros a pleno, el RNG debe cubrir los 37 números
const cookie2 = cookieOf(await call(register, { body: { ...good, username: 'Estadista', email: 'e@example.com' } }));
const seen = new Set();
for (let i = 0; i < 700; i++) {
  const s = await call(spin, { cookie: cookie2, body: { bets: { n0: 1 } }, ip: nextIp() });
  if (s.status === 200) seen.add(s.json.number);
  else break;
  if (seen.size === 37) break;
}
assert.ok(seen.size >= 30, `solo salieron ${seen.size} números distintos`); ok(`el RNG cubre el tablero (${seen.size}/37 números vistos)`);

console.log('Bono diario');
r = await call(daily, { cookie });
assert.equal(r.status, 200); assert.equal(r.json.amount, 100); ok('bono diario base (sin NFT)');
r = await call(daily, { cookie });
assert.equal(r.status, 429); ok('no se puede reclamar dos veces');

console.log('Wallet y NFT');
const wallet = Wallet.createRandom();
r = await call(nonce, { cookie, body: { address: 'no-es-wallet' } });
assert.equal(r.status, 400); ok('dirección inválida rechazada');
r = await call(nonce, { cookie, body: { address: wallet.address } });
assert.equal(r.status, 200);
const goodSig = await wallet.signMessage(r.json.message);
const other = Wallet.createRandom();
const badSig = await other.signMessage(r.json.message);
r = await call(link, { cookie, body: { address: wallet.address, signature: badSig } });
assert.equal(r.status, 401); ok('firma de otra wallet rechazada');
r = await call(link, { cookie, body: { address: wallet.address, signature: goodSig } });
assert.equal(r.status, 400); ok('el nonce es de un solo uso');
r = await call(nonce, { cookie, body: { address: wallet.address } });
const sig2 = await wallet.signMessage(r.json.message);
r = await call(link, { cookie, body: { address: wallet.address, signature: sig2 } });
assert.equal(r.status, 200); assert.equal(r.json.wallet, wallet.address.toLowerCase()); ok('wallet vinculada con firma válida');
r = await call(nonce, { cookie: cookie2, body: { address: wallet.address } });
const sig3 = await wallet.signMessage(r.json.message);
r = await call(link, { cookie: cookie2, body: { address: wallet.address, signature: sig3 } });
assert.equal(r.status, 409); ok('una wallet no puede estar en dos cuentas');
r = await call(nftStatus, { method: 'GET', cookie });
assert.equal(r.status, 200); assert.equal(r.json.configured, false); assert.equal(r.json.count, 0); ok('estado NFT sin RPC configurado (sin beneficios, sin errores)');

console.log('Cerrar sesión');
r = await call(logout, { cookie });
assert.equal(r.status, 200);
r = await call(me, { method: 'GET', cookie });
assert.equal(r.status, 401); ok('tras cerrar sesión, la cookie antigua queda invalidada');

console.log(`\n${passed} comprobaciones OK`);
process.exit(0);
