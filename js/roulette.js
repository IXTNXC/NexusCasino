import { api, fmt } from '/js/api.js';
import { linkWallet, shortAddr } from '/js/wallet.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- Datos de la ruleta europea ----------
const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
const CHIPS = [1, 5, 25, 100, 500];
const MAX_TOTAL = 10000;

// Solo para resaltar visualmente las casillas ganadoras. El dinero lo decide siempre el servidor.
const RULES = {
  low: (n) => n >= 1 && n <= 18, high: (n) => n >= 19, even: (n) => n > 0 && n % 2 === 0, odd: (n) => n % 2 === 1,
  red: (n) => REDS.has(n), black: (n) => n > 0 && !REDS.has(n),
  d1: (n) => n >= 1 && n <= 12, d2: (n) => n >= 13 && n <= 24, d3: (n) => n >= 25,
  c1: (n) => n > 0 && n % 3 === 1, c2: (n) => n > 0 && n % 3 === 2, c3: (n) => n > 0 && n % 3 === 0,
};
const wins = (id, n) => (/^n\d+$/.test(id) ? Number(id.slice(1)) === n : RULES[id](n));

// ---------- Estado ----------
const state = { balance: 0, chip: 5, bets: {}, stack: [], last: null, spinning: false, rotation: 0 };
const totalBet = () => Object.values(state.bets).reduce((a, b) => a + b, 0);

function say(html) { $('result').replaceChildren(...html); }
const text = (t) => document.createTextNode(t);
function notice(t) { say([text(t)]); }

// ---------- Tablero ----------
function chipClass(v) {
  let c = 1;
  for (const x of CHIPS) if (v >= x) c = x;
  return 'v' + c;
}

function buildBoard() {
  const board = $('board');
  const mk = (id, label, cls) => {
    const b = el('button', 'cell ' + cls, label);
    b.type = 'button';
    b.dataset.bet = id;
    return b;
  };
  board.appendChild(mk('n0', '0', 'zero'));
  const colIds = ['c3', 'c2', 'c1'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const n = col * 3 + (3 - row);
      board.appendChild(mk('n' + n, String(n), 'num ' + colorOf(n)));
    }
    board.appendChild(mk(colIds[row], '2:1', 'out col2'));
  }
  board.appendChild(el('div', 'spacer'));
  [['d1', '1ª docena'], ['d2', '2ª docena'], ['d3', '3ª docena']].forEach(([id, l]) => board.appendChild(mk(id, l, 'out dozen')));
  board.appendChild(el('div', 'spacer'));
  board.appendChild(el('div', 'spacer'));
  board.appendChild(mk('low', '1 - 18', 'out half'));
  board.appendChild(mk('even', 'PAR', 'out half'));
  const red = mk('red', '', 'out half'); red.appendChild(el('span', 'diamond red')); board.appendChild(red);
  const blk = mk('black', '', 'out half'); blk.appendChild(el('span', 'diamond black')); board.appendChild(blk);
  board.appendChild(mk('odd', 'IMPAR', 'out half'));
  board.appendChild(mk('high', '19 - 36', 'out half'));
  board.appendChild(el('div', 'spacer'));

  board.addEventListener('click', (e) => {
    const c = e.target.closest('.cell');
    if (c) placeBet(c.dataset.bet);
  });
}

function buildChips() {
  const box = $('chips');
  for (const v of CHIPS) {
    const b = el('button', `chip v${v}${v === state.chip ? ' sel' : ''}`, String(v));
    b.type = 'button';
    b.addEventListener('click', () => {
      state.chip = v;
      box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('sel', x === b));
    });
    box.appendChild(b);
  }
}

function placeBet(id) {
  if (state.spinning) return;
  if (totalBet() + state.chip > Math.min(state.balance, MAX_TOTAL)) {
    return notice(state.balance < totalBet() + state.chip ? 'Saldo insuficiente para esa ficha.' : 'Has alcanzado el máximo por giro.');
  }
  document.querySelectorAll('.cell.win').forEach((c) => c.classList.remove('win'));
  state.bets[id] = (state.bets[id] || 0) + state.chip;
  state.stack.push([id, state.chip]);
  refresh();
}

function refresh() {
  $('balance').textContent = fmt(state.balance - totalBet());
  $('total').textContent = fmt(totalBet());
  document.querySelectorAll('.cell').forEach((c) => {
    c.querySelector('.stack')?.remove();
    const amt = state.bets[c.dataset.bet];
    if (amt) c.appendChild(el('span', `stack ${chipClass(amt)}`, amt >= 1000 ? Math.round(amt / 100) / 10 + 'k' : String(amt)));
  });
}

$('undo').addEventListener('click', () => {
  if (state.spinning || !state.stack.length) return;
  const [id, amt] = state.stack.pop();
  state.bets[id] -= amt;
  if (state.bets[id] <= 0) delete state.bets[id];
  refresh();
});
$('clear').addEventListener('click', () => {
  if (state.spinning) return;
  state.bets = {}; state.stack = [];
  refresh();
});
$('rebet').addEventListener('click', () => {
  if (state.spinning || !state.last) return;
  const total = Object.values(state.last).reduce((a, b) => a + b, 0);
  if (total > state.balance) return notice('Saldo insuficiente para repetir la apuesta.');
  state.bets = { ...state.last };
  state.stack = Object.entries(state.last).map(([id, amt]) => [id, amt]);
  refresh();
});

// ---------- Rueda ----------
const canvas = $('wheel');
const ctx = canvas.getContext('2d');
const W = canvas.width, C = W / 2, SEG = (Math.PI * 2) / ORDER.length;
const R_OUT = C - 72, R_IN = R_OUT - 66, R_TRACK = C - 40;

function disc(r, fill) { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function ring(r, w, stroke) { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.lineWidth = w; ctx.strokeStyle = stroke; ctx.stroke(); }

function drawWheel(ball) {
  ctx.clearRect(0, 0, W, W);
  const wood = ctx.createRadialGradient(C, C, C * 0.6, C, C, C);
  wood.addColorStop(0, '#6b3e1d'); wood.addColorStop(0.75, '#3d210e'); wood.addColorStop(1, '#1d0f06');
  disc(C - 2, wood);
  ring(C - 10, 5, '#d4af37');
  // pista de la bola
  const track = ctx.createRadialGradient(C, C, R_OUT, C, C, C - 20);
  track.addColorStop(0, '#2a1608'); track.addColorStop(1, '#4a2a14');
  disc(C - 22, track);
  ring(C - 22, 2, '#f7e08a99');

  // bolsillos
  ORDER.forEach((n, i) => {
    const a0 = state.rotation + i * SEG - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(C, C, R_OUT, a0, a0 + SEG);
    ctx.arc(C, C, R_IN, a0 + SEG, a0, true);
    ctx.closePath();
    ctx.fillStyle = { red: '#b3121f', black: '#101010', green: '#0f7a3c' }[colorOf(n)];
    ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#d4af37'; ctx.stroke();
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(a0 + SEG / 2);
    ctx.translate(R_OUT - 20, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(n), 0, 6);
    ctx.restore();
  });
  ring(R_OUT, 4, '#d4af37');
  ring(R_IN, 3, '#d4af37');

  // cono central y torreta
  const cone = ctx.createRadialGradient(C, C, 10, C, C, R_IN);
  cone.addColorStop(0, '#f7e08a'); cone.addColorStop(0.45, '#b9922b'); cone.addColorStop(1, '#5b4310');
  disc(R_IN - 2, cone);
  ring(R_IN * 0.62, 2, '#fff6');
  ring(R_IN * 0.3, 2, '#fff6');
  ctx.save();
  ctx.translate(C, C);
  ctx.rotate(state.rotation);
  ctx.strokeStyle = '#f7e08a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, R_IN * 0.62); ctx.stroke();
    ctx.fillStyle = '#f7e08a';
    ctx.beginPath(); ctx.arc(0, R_IN * 0.62, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  disc(24, '#d4af37'); ring(24, 3, '#8a6a14'); disc(9, '#fff3c4');

  // marcador superior
  ctx.fillStyle = '#f7e08a';
  ctx.beginPath(); ctx.moveTo(C - 11, 6); ctx.lineTo(C + 11, 6); ctx.lineTo(C, 30); ctx.closePath(); ctx.fill();

  // bola
  if (ball) {
    const x = C + ball.r * Math.cos(ball.a), y = C + ball.r * Math.sin(ball.a);
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#b8b8b8');
    ctx.beginPath(); ctx.arc(x + 2, y + 3, 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }
}

// El número ya viene decidido por el servidor; aquí solo se anima hasta él.
function animateTo(winIdx) {
  return new Promise((resolve) => {
    const TAU = Math.PI * 2;
    const base = -((winIdx + 0.5) * SEG);
    let target = base + TAU * (6 + Math.floor(Math.random() * 3));
    while (target < state.rotation + TAU * 5) target += TAU;
    const start = state.rotation, dist = target - start, dur = 6200, t0 = performance.now();
    const easeW = (t) => 1 - Math.pow(1 - t, 3);
    const easeB = (t) => 1 - Math.pow(1 - t, 2.2);
    const R_POCKET = R_OUT - 20;
    (function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      state.rotation = start + dist * easeW(t);
      const a = -Math.PI / 2 + (1 - easeB(t)) * TAU * 9; // la bola gira en sentido contrario
      const k = t < 0.68 ? 0 : Math.pow((t - 0.68) / 0.32, 2);
      drawWheel({ a, r: R_TRACK + (R_POCKET - R_TRACK) * k });
      t < 1 ? requestAnimationFrame(frame) : resolve();
    })(t0);
  });
}

// ---------- Giro ----------
function addHistory(n) {
  const d = el('div', 'dot ' + colorOf(n), String(n));
  $('history').prepend(d);
  while ($('history').children.length > 14) $('history').lastChild.remove();
}

$('spin').addEventListener('click', async () => {
  if (state.spinning) return;
  const bets = { ...state.bets };
  const staked = totalBet();
  if (!staked) return notice('Coloca al menos una apuesta.');

  state.spinning = true;
  $('spin').disabled = true;
  notice('No va más…');
  try {
    const r = await api('/api/spin', { method: 'POST', body: { bets } });
    await animateTo(ORDER.indexOf(r.number));

    const out = [text('Salió '), el('b', '', String(r.number)), text(` (${{ red: 'Rojo', black: 'Negro', green: 'Verde' }[r.color]}) · `)];
    if (r.net > 0) out.push(el('b', 'gain', `+${fmt(r.net)}`));
    else if (r.net === 0) out.push(text('Recuperas tu apuesta'));
    else out.push(el('b', 'loss', fmt(r.net)));
    if (r.cashback > 0) out.push(text(` · Cashback ${r.tier}: +${fmt(r.cashback)}`));
    say(out);
    addHistory(r.number);

    document.querySelectorAll('.cell').forEach((c) => {
      if (bets[c.dataset.bet] && wins(c.dataset.bet, r.number)) c.classList.add('win');
    });
    state.balance = r.balance;
    state.last = bets;
    state.bets = {}; state.stack = [];
  } catch (e) {
    if (e.status === 401) return location.replace('/');
    notice(e.message);
    drawWheel();
  } finally {
    state.spinning = false;
    $('spin').disabled = false;
    refresh();
  }
});

// ---------- Cuenta, bono, wallet y NFT ----------
function renderNft(s) {
  $('wallet-btn').textContent = s.wallet ? shortAddr(s.wallet) : 'Conectar wallet';
  const badge = $('tier');
  badge.className = 'badge' + (s.tier ? ' ' + s.tier.id : '');
  badge.textContent = s.tier ? s.tier.name : 'Jugador';

  const body = $('nft-body');
  body.replaceChildren();
  if (!s.configured) {
    body.appendChild(el('p', '', 'Las ventajas NFT todavía no están activadas en este casino.'));
  } else {
    body.appendChild(el('p', '', s.wallet
      ? `Wallet vinculada con ${s.count} NFT de ${s.collection}.`
      : `Vincula la wallet donde guardas tus NFT de ${s.collection} para activar tus ventajas.`));
  }
  const table = el('table', 'tier-table');
  const head = el('tr');
  ['Nivel', 'NFT', 'Bono diario', 'Cashback'].forEach((h) => head.appendChild(el('th', '', h)));
  table.appendChild(head);
  const base = el('tr', s.tier ? '' : 'me');
  ['Jugador', '0', fmt(s.baseDaily), '0 %'].forEach((c) => base.appendChild(el('td', '', c)));
  table.appendChild(base);
  for (const t of s.tiers) {
    const tr = el('tr', s.tier && s.tier.id === t.id ? 'me' : '');
    [t.name, `${t.min}+`, fmt(t.dailyBonus), `${t.cashbackPct} %`].forEach((c) => tr.appendChild(el('td', '', c)));
    table.appendChild(tr);
  }
  body.appendChild(table);
  body.appendChild(el('p', '', 'El cashback devuelve un porcentaje de lo que pierdes en cada giro.'));
}

async function loadNft() {
  try {
    renderNft(await api('/api/nft/status'));
  } catch (e) {
    $('nft-body').textContent = e.message;
  }
}

$('wallet-btn').addEventListener('click', async () => {
  const btn = $('wallet-btn');
  btn.disabled = true;
  try {
    await linkWallet();
    notice('Wallet vinculada correctamente.');
    await loadNft();
  } catch (e) {
    notice(e.code === 4001 ? 'Cancelaste la firma en tu wallet.' : e.message || 'No se pudo vincular la wallet.');
  } finally {
    btn.disabled = false;
  }
});

$('daily').addEventListener('click', async () => {
  try {
    const r = await api('/api/daily', { method: 'POST' });
    state.balance = r.balance;
    refresh();
    notice(`Bono diario: +${fmt(r.amount)} NXS${r.tier ? ` (nivel ${r.tier})` : ''}.`);
  } catch (e) {
    notice(e.message);
  }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignorar */ }
  location.href = '/';
});

// Música ambiente opcional: coloca tu archivo en /music/ambient.mp3
let audio = null;
$('music').addEventListener('click', () => {
  const btn = $('music');
  if (!audio) {
    audio = new Audio('/music/ambient.mp3');
    audio.loop = true; audio.volume = 0.35;
    audio.addEventListener('error', () => {
      audio = null;
      btn.setAttribute('aria-pressed', 'false');
      notice('Añade tu música en la carpeta music/ con el nombre ambient.mp3.');
    });
  }
  const on = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', String(on));
  on ? audio.play().catch(() => {}) : audio.pause();
});

// ---------- Arranque ----------
(async function boot() {
  try {
    const { user } = await api('/api/auth/me');
    $('who').textContent = user.name;
    state.balance = user.balance;
  } catch {
    location.replace('/');
    return;
  }
  buildBoard();
  buildChips();
  drawWheel({ a: -Math.PI / 2, r: R_TRACK });
  refresh();
  loadNft();
})();
