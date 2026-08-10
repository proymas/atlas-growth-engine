$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$logDir = Join-Path $repo '.logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'reddit-worker.log'
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"`n===== Reddit worker $stamp =====" | Out-File -FilePath $log -Append -Encoding utf8

# Pull safe fast-forward updates so the worker can receive improvements without manual intervention.
cmd.exe /d /c "git pull --ff-only >> `"$log`" 2>&1"
"git_pull_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

cmd.exe /d /c "npm.cmd run reddit:radar >> `"$log`" 2>&1"
"radar_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

cmd.exe /d /c "npm.cmd run reddit:prepare-actions >> `"$log`" 2>&1"
"prepare_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

cmd.exe /d /c "npm.cmd run reddit:followups >> `"$log`" 2>&1"
"followup_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

# Publishing is intentionally gated behind REDDIT_LIVE_POSTING=1.
cmd.exe /d /c "npm.cmd run reddit:publish >> `"$log`" 2>&1"
"publish_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

exit 0
