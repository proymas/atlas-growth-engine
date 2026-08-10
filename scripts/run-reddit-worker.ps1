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

# Load simple KEY=VALUE entries from the local .env into this worker process.
# Secrets stay local and are never committed to GitHub.
$envFile = Join-Path $repo '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -le 0) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  "env_loaded=true" | Out-File -FilePath $log -Append -Encoding utf8
} else {
  "env_loaded=false" | Out-File -FilePath $log -Append -Encoding utf8
}

cmd.exe /d /c "npm.cmd run reddit:radar >> `"$log`" 2>&1"
"radar_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

cmd.exe /d /c "npm.cmd run reddit:prepare-actions >> `"$log`" 2>&1"
"prepare_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

cmd.exe /d /c "npm.cmd run reddit:followups >> `"$log`" 2>&1"
"followup_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

# Publishing remains intentionally gated behind REDDIT_LIVE_POSTING=1.
cmd.exe /d /c "npm.cmd run reddit:publish >> `"$log`" 2>&1"
"publish_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

# Central telemetry/memory: upsert qualified Reddit threads and action state into Airtable.
cmd.exe /d /c "npm.cmd run reddit:airtable-sync >> `"$log`" 2>&1"
"airtable_exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8

exit 0
