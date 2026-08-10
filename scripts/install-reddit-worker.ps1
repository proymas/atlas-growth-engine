$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $repo 'scripts\run-reddit-worker.ps1'
$taskName = 'AtlasRedditRadar'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

try { powercfg /change standby-timeout-ac 0 | Out-Null } catch {}

Write-Host "OK: tarea $taskName instalada. Se ejecutara cada hora mientras Windows siga encendido y tu sesion permanezca iniciada."
Write-Host "Logs: $repo\.logs\reddit-worker.log"
Write-Host "Primera ejecucion programada en aproximadamente 2 minutos."
