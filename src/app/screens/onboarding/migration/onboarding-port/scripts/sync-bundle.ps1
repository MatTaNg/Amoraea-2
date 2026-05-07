# Re-copy onboarding-related trees into migration/onboarding-port/bundle
# Run from repo root:  powershell -File migration/onboarding-port/scripts/sync-bundle.ps1

$ErrorActionPreference = "Stop"
# PSScriptRoot = .../migration/onboarding-port/scripts → repo root is 3 levels up
$root = $PSScriptRoot
for ($i = 0; $i -lt 3; $i++) {
  $root = Split-Path $root -Parent
}
if (-not (Test-Path "$root\app\onboarding")) {
  Write-Error "Run this script from the Amoraea-app repo root (expected app\onboarding)."
}
$dest = Join-Path $root "migration\onboarding-port\bundle"
Write-Host "Root: $root"
Write-Host "Dest: $dest"

if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$dirs = @(
  @("app\onboarding", "app\onboarding"),
  @("screens\onboarding", "screens\onboarding"),
  @("screens\assessments", "screens\assessments"),
  @("data\services\onboarding", "data\services\onboarding"),
  @("data\assessments", "data\assessments")
)
foreach ($pair in $dirs) {
  $src = Join-Path $root $pair[0]
  $dst = Join-Path $dest $pair[1]
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
}

New-Item -ItemType Directory -Force -Path (Join-Path $dest "data\services") | Out-Null
$files = @(
  "onboardingService.ts",
  "assessmentService.ts",
  "assessmentAiInsightService.ts",
  "conflictStyleService.ts"
)
foreach ($f in $files) {
  Copy-Item (Join-Path $root "data\services\$f") (Join-Path $dest "data\services\$f")
}

$listPath = Join-Path (Split-Path $dest -Parent) "FILE_LIST.txt"
Get-ChildItem -Path $dest -Recurse -File |
  ForEach-Object { $_.FullName.Replace("$dest\", "").Replace("\", "/") } |
  Sort-Object |
  Set-Content $listPath

Write-Host "Done. Files listed in migration/onboarding-port/FILE_LIST.txt"
