$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
New-Item -ItemType Directory -Force -Path '.logs' | Out-Null
$log = Join-Path $repo '.logs\x-worker.log'
"`n===== X WORKER $(Get-Date -Format o) =====" | Out-File -FilePath $log -Append -Encoding utf8
$steps = @('x:radar','x:prepare-actions','x:followups','x:publish','x:airtable-sync')
foreach ($step in $steps) {
  "`n> npm.cmd run $step" | Out-File $log -Append -Encoding utf8
  & npm.cmd run $step *>> $log
  "${step}_exit=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
}
