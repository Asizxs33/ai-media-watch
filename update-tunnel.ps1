param(
    [Parameter(Mandatory=$true)]
    [string]$TunnelUrl
)

$TunnelUrl = $TunnelUrl.TrimEnd('/')
Write-Host "Updating Vercel: $TunnelUrl" -ForegroundColor Cyan

$authToken = (Get-Content "$env:APPDATA\com.vercel.cli\Data\auth.json" | ConvertFrom-Json).token
$projectId = "prj_PT3a0sFwNHpd8jmyA5j3RtKUAI5i"
$teamId    = "team_WngdiORE8vvNV3G1ekbikwzn"
$headers   = @{ Authorization = "Bearer $authToken"; "Content-Type" = "application/json" }

$existing = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $headers
$old = $existing.envs | Where-Object { $_.key -eq "VITE_BACKEND_URL" }
if ($old) {
    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env/$($old.id)?teamId=$teamId" -Method DELETE -Headers $headers | Out-Null
    Write-Host "Old URL removed" -ForegroundColor Yellow
}

$body = @{ key = "VITE_BACKEND_URL"; value = $TunnelUrl; type = "plain"; target = @("production") } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Method POST -Headers $headers -Body $body | Out-Null
Write-Host "New URL saved" -ForegroundColor Green

Write-Host "Deploying..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\ai-media-watch
vercel --prod --yes 2>&1 | Select-String -Pattern "Aliased|Error|READY"

Write-Host "Done! https://ai-media-watch.vercel.app" -ForegroundColor Green
