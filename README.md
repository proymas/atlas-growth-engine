# Atlas Growth Engine

Infraestructura independiente de Growth para Atlas. Este repositorio está aislado del producto principal (`atlas` / `atlas-validator`).

## Objetivo v0

Sustituir progresivamente la dependencia de ChatGPT Work para Radar y ejecución operativa, empezando por Reddit.

## Stack inicial

- Node.js 20+
- TypeScript
- Playwright
- Chromium
- GitHub Actions
- Airtable (CRM, en fase posterior)

## Estado actual

Playwright + Chromium funcionan correctamente en GitHub Actions. El frontend público de Reddit devuelve 403 desde runners de GitHub, por lo que Reddit se integra mediante OAuth/API oficial para lectura y publicación, dejando Playwright para plataformas o acciones donde la API no sea suficiente.

## Arranque local

```bash
npm install
npm run browser:install
npm run typecheck
npm run smoke:reddit
```

## Reddit OAuth

Variables necesarias, siempre como secretos y nunca en Git:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `REDDIT_REFRESH_TOKEN` (solo cuando activemos acciones como usuario)

Con `REDDIT_CLIENT_ID` y `REDDIT_CLIENT_SECRET` configurados puede probarse lectura OAuth con:

```bash
npm run smoke:reddit-oauth
```

El cliente utiliza `https://oauth.reddit.com` y solicita tokens en `https://www.reddit.com/api/v1/access_token`.

## Seguridad

- No guardar tokens, contraseñas, cookies ni estados autenticados en Git.
- `.auth/` y `.env*` están excluidos.
- No reutilizar recursos técnicos del producto principal de Atlas.
- La publicación se activará únicamente con una autorización OAuth explícita y scopes mínimos.

## Siguiente hito

1. Crear/autorizar la app OAuth de Reddit.
2. Añadir credenciales como GitHub Actions Secrets.
3. Validar lectura de `/r/SideProject/new` desde `oauth.reddit.com`.
4. Construir Reddit Radar v0 en modo lectura.
5. Integrar deduplicación/Airtable.
6. Añadir generación de drafts.
7. Activar publicación controlada y follow-up con OAuth de usuario.
