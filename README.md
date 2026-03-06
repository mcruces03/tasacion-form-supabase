# Valoración de Inmueble (Vercel stack)

App de valoración de inmuebles para uso por agentes. Misma funcionalidad que el proyecto original, con este stack:

- **Frontend**: Vite + React (desplegado en **Vercel**)
- **Backend**: **Vercel Serverless Functions**
- **Email**: **Gmail API** (OAuth2)
- **Base de datos**: **Supabase** (guardado de formularios)
- **Dominio**: **Cloudflare** (opcional)

## Funciones

- Formulario responsive (datos de visita, edificio, descripción, titulación, medidas).
- Exportar a **PDF** y **Excel** desde el navegador.
- **Enviar por email**: genera PDF y Excel y los envía vía Gmail API; además guarda los datos en Supabase si está configurado.
- **Guardar en BD**: guardar el formulario actual en Supabase sin enviar email.
- Los datos del formulario se persisten en `localStorage` entre recargas.

## Desarrollo local

```bash
npm install
npx vercel dev
```

Abre la URL que indique Vercel (p. ej. `http://localhost:3000`). El frontend y las rutas `/api/*` funcionan en local.

Solo frontend (sin API):

```bash
npm run dev
```

Configura `.env.local` con las variables de `.env.example` para que send-report y valoraciones funcionen en local.

## Despliegue

Ver [DEPLOY.md](./DEPLOY.md) para configurar Vercel, Gmail API (OAuth2), Supabase y opcionalmente Cloudflare.

## Estructura

- `src/` — Frontend (React, tipos, componentes, export PDF/Excel, persistencia en localStorage).
- `api/` — Vercel Serverless:
  - `health.ts` — Estado del servicio.
  - `send-report.ts` — Recibe email + PDF + Excel + JSON del form; envía con Gmail API y guarda en Supabase.
  - `valoraciones.ts` — GET lista de valoraciones, POST guardar una valoración.
- `supabase/migrations/` — Migración de la tabla `valoraciones`.
# tasacion-form-supabase
