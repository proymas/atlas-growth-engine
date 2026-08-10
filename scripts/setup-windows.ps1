$ErrorActionPreference = 'Stop'

Write-Host '=== Atlas Growth Engine - Windows setup ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js no esta instalado o no esta en PATH.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm no esta disponible.'
}

Write-Host ('Node: ' + (node -v))
Write-Host ('npm:  ' + (npm -v))

Write-Host 'Instalando dependencias npm...'
npm install

Write-Host 'Instalando Chromium de Playwright...'
npx playwright install chromium

Write-Host 'Comprobando TypeScript...'
npm run typecheck

Write-Host ''
Write-Host 'Setup completado.' -ForegroundColor Green
Write-Host 'Siguiente paso: npm run smoke:reddit'
