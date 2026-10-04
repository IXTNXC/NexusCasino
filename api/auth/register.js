import bcrypt from 'bcryptjs';
import { api, send } from '../_lib/http.js';
import { HttpError } from '../_lib/errors.js';
import { db } from '../_lib/redis.js';
import { issueSession } from '../_lib/session.js';
import { getUser, publicUser } from '../_lib/users.js';
import { str, USERNAME_RE, validEmail, validPassword, ageFrom } from '../_lib/validate.js';
import { START_BALANCE } from '../_lib/config.js';

export default api({ methods: ['POST'], limit: { key: 'register', max: 5, windowSec: 3600 } }, async ({ req, res, body }) => {
  const username = str(body.username, 32);
  const email = str(body.email, 254).toLowerCase();
  const birth = str(body.birth, 10);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Usuario: 3-16 caracteres (letras, números o guion bajo).');
  if (!validEmail(email)) throw new HttpError(400, 'Correo electrónico no válido.');
  const age = ageFrom(birth);
  if (age === null || age > 120) throw new HttpError(400, 'Fecha de nacimiento no válida.');
  if (age < 18) throw new HttpError(403, 'Debes ser mayor de 18 años.');
  if (!validPassword(password)) throw new HttpError(400, 'La contraseña debe tener entre 8 y 72 caracteres, con letras y números.');
  if (body.terms !== true) throw new HttpError(400, 'Debes aceptar los términos y condiciones.');

  const key = username.toLowerCase();
  const r = db();
  const hash = await bcrypt.hash(password, 11);

  // Reservas atómicas: dos registros simultáneos nunca pueden quedarse con el mismo usuario/correo
  const emailOk = await r.set(`e:${email}`, key, { nx: true });
  if (!emailOk) throw new HttpError(409, 'Ese correo ya está registrado.');
  const nameOk = await r.hsetnx(`u:${key}`, 'name', username);
  if (!nameOk) {
    await r.del(`e:${email}`);
    throw new HttpError(409, 'Ese nombre de usuario ya existe.');
  }
  await r.hset(`u:${key}`, { email, hash, bal: START_BALANCE, created: Date.now(), sv: 0, wallet: '' });

  await issueSession(req, res, key, 0);
 send(res, 201, { user: publicUser({ name: username, bal: START_BALANCE, wallet: null, created: Date.now() }) });
});
