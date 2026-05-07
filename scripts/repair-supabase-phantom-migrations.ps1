#Requires -Version 5.1
<#
.SYNOPSIS
  Removes legacy phantom migration IDs (0001..0073) from the LINKED project's
  supabase_migrations.schema_migrations table so this repo can own migrations via `db push`.

.DESCRIPTION
  Running SQL in the Dashboard does NOT fix "Remote migration versions not found in local
  migrations directory" — that error is only about the migration *history* table vs filenames
  in supabase/migrations/.

  After repair, run `npx supabase db push` to apply local timestamp migrations.

  Prereq: `npx supabase link` (or env) for the target project.

.NOTES
  If `db push` then fails with "already exists", your DB already matches most migrations; use
  `npx supabase migration repair <timestamp> --status applied` for each local file that is
  already reflected in the database (see Supabase migration repair docs).
#>

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$versions = New-Object System.Collections.Generic.List[string]
foreach ($i in 1..29) { [void]$versions.Add(('{0:D4}' -f $i)) }
foreach ($i in 31..44) { [void]$versions.Add(('{0:D4}' -f $i)) }
foreach ($i in 46..48) { [void]$versions.Add(('{0:D4}' -f $i)) }
foreach ($i in 50..73) { [void]$versions.Add(('{0:D4}' -f $i)) }

Write-Host "Repairing $($versions.Count) phantom remote migration versions (reverted) on linked project..."
$repairArgs = $versions.ToArray() + @('--status', 'reverted')
& npx supabase migration repair @repairArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "migration repair failed with exit $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "`nPushing local migrations..."
& npx supabase db push
exit $LASTEXITCODE
