$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logDir = Join-Path $repo '.logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'reddit-worker.log'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"`n===== Reddit worker $stamp =====" | Out-File -FilePath $log -Append -Encoding utf8
cmd.exe /d /c "npm.cmd run reddit:radar >> `"$log`" 2>&1"
"exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8
exit $LASTEXITCODE
