import { api, GAME_URL } from '/js/api.js';

const $ = (id) => document.getElementById(id);

function show(tab) {
  const login = tab === 'login';
  $('tab-login').classList.toggle('active', login);
  $('tab-register').classList.toggle('active', !login);
  $('tab-login').setAttribute('aria-selected', String(login));
  $('tab-register').setAttribute('aria-selected', String(!login));
  $('form-login').classList.toggle('active', login);
  $('form-register').classList.toggle('active', !login);
}
$('tab-login').addEventListener('click', () => show('login'));
$('tab-register').addEventListener('click', () => show('register'));

function setMsg(id, text, ok = false) {
  const el = $(id);
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
}

async function submit(form, msgId, path, payload) {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  setMsg(msgId, '');
  try {
    const { user } = await api(path, { method: 'POST', body: payload });
    setMsg(msgId, `Bienvenido, ${user.name}.`, true);
    location.href = GAME_URL;
  } catch (e) {
    setMsg(msgId, e.message);
    btn.disabled = false;
  }
}

$('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target, 'msg-login', '/api/auth/login', {
    username: $('l-user').value.trim(),
    password: $('l-pass').value,
  });
});

$('form-register').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('r-pass').value !== $('r-pass2').value) return setMsg('msg-register', 'Las contraseñas no coinciden.');
  if (!$('r-terms').checked) return setMsg('msg-register', 'Debes aceptar los términos y confirmar que eres mayor de 18 años.');
  submit(e.target, 'msg-register', '/api/auth/register', {
    username: $('r-user').value.trim(),
    email: $('r-email').value.trim(),
    birth: $('r-birth').value,
    password: $('r-pass').value,
    terms: true,
  });
});

// Si ya hay sesión activa, ir directo a la ruleta
api('/api/auth/me')
  .then(() => (location.href = GAME_URL))
  .catch(() => {});
