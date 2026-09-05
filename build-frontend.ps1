<#
.SYNOPSIS
    Builds the Billing frontend and deploys the output into Billing/Billing-SPA.

.DESCRIPTION
    Runs `npm run build` against the frontend repo, then replaces the contents
    of Billing/Billing-SPA with the fresh output. Vite gives its JS/CSS files a
    new content hash on every build, so this clears the old copy first rather
    than copying on top of it -- otherwise stale files from previous builds
    just pile up alongside the current ones.

    Exits with a non-zero code on any failure -- this is called from
    Billing.csproj's BuildFrontend target during Publish, and MSBuild's <Exec>
    task only notices a failure via the process exit code, not the error text.

.PARAMETER FrontendPath
    Path to the billing-app frontend source. Defaults to the billing-app/ folder
    living alongside this script (both are part of the same Aim-Billing repo);
    pass -FrontendPath if your checkout puts it somewhere else.

.EXAMPLE
    .\build-frontend.ps1
    .\build-frontend.ps1 -FrontendPath "D:\repos\billing-app"
#>
param(
    [string]$FrontendPath = (Join-Path $PSScriptRoot "billing-app")
)

$ErrorActionPreference = "Stop"

try {
    $SpaPath = Join-Path $PSScriptRoot "Billing\Billing-SPA"

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found on PATH. Install Node.js (or open a fresh terminal after installing it) and try again."
    }

    if (-not (Test-Path $FrontendPath)) {
        throw "Frontend path not found: $FrontendPath`nPass -FrontendPath if it's checked out somewhere else."
    }

    Write-Host "Building frontend in $FrontendPath ..." -ForegroundColor Cyan
    Push-Location $FrontendPath
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed (exit code $LASTEXITCODE) -- see output above."
        }
    } finally {
        Pop-Location
    }

    $DistPath = Join-Path $FrontendPath "dist"
    if (-not (Test-Path $DistPath)) {
        throw "Build reported success but no dist folder was found at $DistPath."
    }

    Write-Host "Clearing old content from $SpaPath ..." -ForegroundColor Cyan
    if (Test-Path $SpaPath) {
        Get-ChildItem -Path $SpaPath -Force | Remove-Item -Recurse -Force
    } else {
        New-Item -ItemType Directory -Path $SpaPath | Out-Null
    }

    Write-Host "Copying fresh build into $SpaPath ..." -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $DistPath "*") -Destination $SpaPath -Recurse -Force

    Write-Host "Done. Restart (or F5) the Billing project to pick up the new frontend." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "build-frontend.ps1 failed: $_" -ForegroundColor Red
    exit 1
}
