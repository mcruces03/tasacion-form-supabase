# Despliegue — Valoración de Inmueble (Vercel + Gmail API + Supabase + Cloudflare)

Este proyecto usa:

- **Frontend**: Vite + React, desplegado en **Vercel**
- **Backend**: **Vercel Serverless Functions** (carpeta `/api`)
- **Email**: **Gmail API** (OAuth2)
- **Base de datos**: **Supabase**
- **Dominio**: **Cloudflare** (DNS / proxy opcional)

---

## 1. Supabase (base de datos)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecuta la migración:

```sql
-- Archivo: supabase/migrations/001_valoraciones.sql
create table if not exists public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  email_sent_to text,
  created_at timestamptz not null default now()
);
```

3. En **Settings → API** anota:
   - **Project URL** (ej. `https://xxxx.supabase.co`)
   - **anon key** (para el cliente si lo usas)
   - **service_role key** (solo para el backend; no exponer en el frontend)

---

## 2. Gmail API (email)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto (o usa uno existente).
2. Activa la **Gmail API** (APIs & Services → Enable APIs and Services → busca "Gmail API").
3. Crea **credenciales OAuth 2.0** (APIs & Services → Credentials → Create Credentials → OAuth client ID). Tipo: "Desktop app" (o "Web application" si defines URIs de redirección).
4. Descarga el JSON del cliente o anota **Client ID** y **Client Secret**.
5. En el proyecto, instala dependencias y ejecuta el script para obtener el **refresh token**:

```bash
cd /ruta/a/tasacion-form-vercel
npm install
node scripts/get-gmail-oauth-token.js
```

Sigue las instrucciones en pantalla (abre la URL, autoriza, pega el código). El script imprimirá el `GMAIL_REFRESH_TOKEN` para usar en Vercel.

---

## 3. Vercel (frontend + API)

1. Sube el proyecto a GitHub (o conecta tu repo).
2. En [vercel.com](https://vercel.com): **Add New → Project** y selecciona el repo.
3. **Framework Preset**: Vite (o Other).
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment variables** (Settings → Environment Variables):

| Variable | Valor | Notas |
|----------|--------|--------|
| `EMAIL_USER` | `tu_gmail@gmail.com` | Gmail desde el que se envía |
| `GMAIL_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | De Google Cloud |
| `GMAIL_CLIENT_SECRET` | `xxxx` | De Google Cloud |
| `GMAIL_REFRESH_TOKEN` | `xxxx` | Obtenido con `node scripts/get-gmail-oauth-token.js` |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Service role (backend solo) |

Opcional: si prefieres no usar `VITE_*` en el servidor, puedes definir solo `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; el código de las funciones usa ambas variantes.

7. **Deploy**. La app quedará en `https://tu-proyecto.vercel.app`. Las rutas `/api/send-report`, `/api/valoraciones` y `/api/health` serán las serverless functions.

---

## 4. Cloudflare (dominio)

Para usar tu propio dominio (ej. `valoracion.tudominio.com`):

1. En **Cloudflare** añade el sitio (o solo la zona DNS) de tu dominio.
2. Añade un registro **CNAME**:
   - **Nombre**: `valoracion` (o `@` para la raíz).
   - **Destino**: `cname.vercel-dns.com` (o el que indique Vercel al añadir el dominio).
3. En **Vercel**: **Project → Settings → Domains** → Add `valoracion.tudominio.com` (o el que uses).
4. Vercel te indicará si debes usar CNAME a `cname.vercel-dns.com` o un A record. Cloudflare puede quedar en **DNS only** (naranja apagado) o **Proxied** (naranja); con proxy suele funcionar bien.

Si usas **Cloudflare Pages** en lugar de Vercel para el frontend, tendrías que desplegar solo el frontend en Pages y las API en Vercel (u otro proveedor), y configurar el dominio y CORS según esa arquitectura. La guía anterior asume “todo en Vercel + dominio en Cloudflare DNS”.

---

## 5. Variables de entorno locales

Para desarrollo local con `vercel dev` (recomendado para probar frontend + API):

1. Copia `.env.example` a `.env.local`.
2. Rellena `EMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (y opcionalmente `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

```bash
cp .env.example .env.local
```

3. Ejecuta:

```bash
npm install
npx vercel dev
```

Así se sirve el frontend y las rutas `/api/*` en tu máquina.

---

## 6. Resumen de endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado y comprobación de email/DB |
| POST | `/api/send-report` | Multipart: `email`, `form` (JSON), `pdf`, `xlsx`. Envía email con Gmail API y guarda en Supabase |
| GET | `/api/valoraciones` | Lista las últimas valoraciones (desde Supabase) |
| POST | `/api/valoraciones` | Body JSON: `{ "form": { ... } }`. Guarda una valoración en Supabase |

---

## 7. Seguridad

- No expongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend (solo en variables de entorno del backend en Vercel).
- En producción puedes activar **Row Level Security (RLS)** en Supabase y políticas que permitan solo al `service_role` (o a usuarios autenticados) leer/escribir en `valoraciones`, según tu modelo de acceso.
