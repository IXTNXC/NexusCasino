import { api, send } from '../_lib/http.js';
import { publicUser } from '../_lib/users.js';

export default api({ methods: ['GET'], auth: true, limit: { key: 'me', max: 120, windowSec: 60 } }, async ({ res, session }) => {
  send(res, 200, { user: publicUser(session.user) });
});
