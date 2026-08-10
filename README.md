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

## Arranque local

```bash
npm install
npm run browser:install
npm run typecheck
npm run smoke:reddit
```

`smoke:reddit` solo abre una página pública de Reddit y devuelve status, URL y título. No inicia sesión, no publica y no modifica ninguna cuenta.

## Seguridad

- No guardar tokens, contraseñas, cookies ni estados autenticados en Git.
- `.auth/` y `.env*` están excluidos.
- No reutilizar recursos técnicos del producto principal de Atlas.
- Las capacidades de publicación se añadirán únicamente después de validar navegación y autenticación de forma aislada.

## Siguiente hito

1. Verificar CI y navegación pública.
2. Añadir persistencia segura de sesión.
3. Construir Reddit Radar v0 en modo lectura.
4. Integrar deduplicación/Airtable.
5. Añadir generación de drafts.
6. Probar publicación controlada y follow-up.
