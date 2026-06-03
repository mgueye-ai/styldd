# Push supabase/.env.secrets to Edge Functions (run after: npx supabase login)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path 'supabase/.env.secrets')) {
  Write-Host 'Missing supabase/.env.secrets — copy from supabase/.env.secrets.example first.'
  exit 1
}
npx supabase secrets set --env-file supabase/.env.secrets --project-ref gogpjxxsrcjpbugocvnd
Write-Host ""
Write-Host "Verifying secrets were set..."
npx supabase secrets list --project-ref gogpjxxsrcjpbugocvnd
Write-Host 'Done. Wait ~30s, then retry Set up payment wallet in the app.'
