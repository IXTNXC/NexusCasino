import bcrypt from 'bcryptjs';
import { api, send } from '../_lib/http.js';
import { HttpError } from '../_lib/errors.js';
import { db } from '../_lib/redis.js';
import { rateLimit } from '../_lib/security.js';
import { issueSession } from '../_lib/session.js';
import { getUser, publicUser } from '../_lib/users.js';
import { str, USERNAME_RE } from '../_lib/validate.js';

// Se compara siempre contra un hash (aunque el usuario no exista) para que el tiempo de respuesta no revele cuentas
const DUMMY_HASH = bcrypt.hashSync('nexus-dummy-password-1', 11);

export default api({ methods: ['POST'], limit: { key: 'login-ip', max: 20, windowSec: 600 } }, async ({ req, res, body }) => {
  const id = str(body.username, 254).trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!id || !password) throw new HttpError(400, 'Introduce usuario y contraseña.');

  if (!(await rateLimit(`login-user:${id}`, 8, 600))) {
    throw new HttpError(429, 'Demasiados intentos para esta cuenta. Espera 10 minutos.');
  }

  const key = id.includes('@') ? ((await db().get(`e:${id}`)) || '') : id;
  const user = key && USERNAME_RE.test(key) ? await getUser(key) : null;
  const ok = await bcrypt.compare(password, user?.hash || DUMMY_HASH);

  if (!user || !user.hash || !ok) {
    console.log('login fallido', { usuarioEncontrado: !!user, contrasenaCorrecta: !!user && ok });
    throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  }

  await issueSession(req, res, user.key, user.sv);
  send(res, 200, { user: publicUser(user) });
});
