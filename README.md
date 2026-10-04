# NEXUS Casino

Casino online clásico con **ruleta europea**, registro/login seguro, saldo en **NXS** y ventajas para holders de **NFT**. Listo para desplegar en **Vercel**.

```
CASINO/
├── Index.html            → login y registro
├── juego ruleta/
│   └── roulette.html     → la mesa de ruleta
├── style/style.css       → diseño casino clásico (PC y móvil)
├── js/                   → api.js, auth.js, roulette.js, wallet.js
├── img/                  → logo.svg (pon aquí tus imágenes)
├── music/                → pon ambient.mp3 para la música de fondo
├── api/                  → servidor (funciones de Vercel)
├── contracts/NXS.sol     → contrato del token NXS
├── scripts/smoke-test.mjs→ pruebas automáticas del servidor
├── vercel.json           → cabeceras de seguridad y rutas
└── package.json
```

## 1. Cómo funciona la seguridad

| Amenaza | Defensa |
|---|---|
| Trampas / manipular el resultado | El resultado de cada giro lo calcula **el servidor** con `crypto.randomInt`. El navegador solo anima. Las apuestas se validan una a una. |
| Modificar el saldo desde el navegador | El saldo vive solo en la base de datos. Débito y crédito son operaciones atómicas; nunca queda saldo negativo. |
| Robo de contraseñas | Hash **bcrypt** (coste 11). Nunca se guarda ni se devuelve la contraseña. |
| Robo de sesión | Cookie `HttpOnly` + `Secure` + `SameSite=Strict`, firmada con JWT. Al cerrar sesión se invalidan **todas** las sesiones de la cuenta. |
| Fuerza bruta | Límite por IP y por cuenta en login; límite en registro y en todos los endpoints. |
| CSRF | Se exige `Content-Type: application/json` y que el `Origin` sea el propio sitio. |
| XSS / inyección de scripts | CSP estricta (`script-src 'self'`, sin scripts ni estilos en línea), la interfaz nunca usa `innerHTML` con datos de usuario. |
| Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'`. |
| Doble giro simultáneo | Bloqueo por cuenta durante cada giro. |
| Suplantar una wallet | Se vincula solo con **firma** de un mensaje con nonce de un solo uso; una wallet no puede estar en dos cuentas. |
| Fugas de claves | Todos los secretos van en variables de entorno de Vercel; nada sensible en el código ni en el navegador. |

> Ningún sitio es "100 % imposible de hackear". Esto cubre los ataques habituales. Además, activa en Vercel el **Firewall / protección DDoS** (Project → Firewall) y revisa los logs de vez en cuando.

## 2. Desplegar en Vercel (paso a paso)

1. Sube esta carpeta a un repositorio de **GitHub** (privado).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio. No cambies nada de build (es un proyecto estático + funciones).
3. **Base de datos**: en el proyecto → **Storage → Create / Marketplace → Upstash Redis**. Conéctala al proyecto: Vercel añade solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_*`). Ambas funcionan.
4. **Secreto de sesiones**: en **Settings → Environment Variables** crea `JWT_SECRET` con **64+ caracteres aleatorios** (usa un generador de contraseñas). Sin él el servidor no arranca, a propósito.
5. (Opcional, para NFT) añade `RPC_URL`, `CHAIN_ID`, `NFT_CONTRACT_ADDRESS`, `NFT_COLLECTION_NAME`. Mira `.env.example`.
6. **Deploy**. Abre tu dominio `*.vercel.app`: la raíz `/` carga `Index.html`.

Para tu propio dominio: **Settings → Domains**.

### Probar en local (PC)
```
npm install
npm test            # pruebas automáticas del servidor
npx vercel dev      # sitio completo en http://localhost:3000
```
En local, sin Upstash configurado, usa una base de datos temporal en memoria.

## 3. Token NXS

`contracts/NXS.sol` es un ERC-20 de **suministro fijo (1.000 millones)**, sin función de crear más tokens y sin dueño: es la opción más segura y transparente.

Desplegarlo sin instalar nada (puedes hacerlo desde el móvil):
1. Abre [remix.ethereum.org](https://remix.ethereum.org) y crea `NXS.sol` pegando el contrato.
2. Compila con Solidity 0.8.24+ (importa OpenZeppelin automáticamente).
3. En **Deploy**, elige *Injected Provider* (tu wallet), la red que prefieras (Polygon, Base, BNB Chain… tienen comisiones bajas) y en `initialHolder` pon **tu wallet**. Pulsa Deploy.
4. Guarda la dirección del contrato y verifícalo en el explorador (Etherscan/Polygonscan…).

> **Importante:** ahora mismo el saldo del casino son **créditos de juego dentro de la base de datos**, mostrados como "NXS". **No hay depósitos ni retiros on-chain.** Es intencional: conectar el token con dinero real implica custodia de fondos (la parte más atacada del mundo cripto), auditoría y licencia de juego. Mira la sección 5.

## 4. Utilidad para tus NFT

El jugador vincula su wallet (firma gratuita) y el servidor lee en la blockchain cuántos NFT de **tu colección** tiene. Los niveles están en `api/_lib/config.js` y los puedes cambiar:

| Nivel | NFT | Bono diario | Cashback sobre pérdidas |
|---|---|---|---|
| Jugador | 0 | 100 | 0 % |
| Holder | 1+ | 500 | 2 % |
| VIP | 5+ | 2.500 | 5 % |
| Whale | 20+ | 10.000 | 10 % |

Soporta colecciones **ERC-721** (por defecto) y **ERC-1155** (`NFT_STANDARD=1155` + `NFT_TOKEN_ID`). Si no configuras `RPC_URL` y `NFT_CONTRACT_ADDRESS`, el casino funciona igual, sin ventajas NFT.

Ideas para ampliar: mesas VIP con límites más altos, torneos solo para holders, o el pago de premios en NXS cuando tengas la parte on-chain auditada.

## 5. Antes de abrirlo al público (leer)

- **Legal**: operar un casino con dinero real, o con un token que se pueda canjear por valor, requiere **licencia de juego** en casi todos los países, además de verificación de identidad (KYC), antilavado (AML) y juego responsable. Mientras sea de créditos sin valor, el riesgo es mucho menor. Consulta a un abogado antes de monetizar.
- **Edad**: ahora se pide la fecha de nacimiento (declarativa). Para dinero real necesitas verificación real de identidad.
- **Contrato**: pide una auditoría antes de lanzar el token con valor.
- **Backups**: Upstash permite backups; actívalos.
- **No guardes claves privadas** en el servidor ni en variables de entorno. Esta versión no las necesita.
