# =============================================================
#  Aplica branch protection a los repos de M6 (Grupo 04)
# -------------------------------------------------------------
#  REQUISITOS:
#   1. Tener `gh` instalado (https://cli.github.com)
#   2. Estar logueado con una cuenta ADMIN de los repos:
#        gh auth login
#      (la cuenta debe ser ADMIN, ej. hllous; un colaborador
#       con solo "write" no puede aplicar branch protection)
#
#  USO:
#   pwsh -File .github/scripts/apply-branch-protection.ps1
#
#  NOTA: usar `pwsh` (PowerShell 7+), no `powershell` (Windows PowerShell
#  5.1) - igual el script escribe el JSON a un archivo temporal en vez de
#  pipearlo a `gh api`, así que ambos motores deberían funcionar, pero
#  pwsh es el probado.
#
#  QUÉ HACE:
#   Para cada repo (backend y frontend) y cada rama (main/test/develop):
#    - Exige 1 aprobación en el PR
#    - Exige checks "build" y "test" (strict)
#    - Squash merge, historial lineal, sin force-push, sin borrar
#    - En main/test exige además revisión de code owner (CODEOWNERS)
# =============================================================

$ErrorActionPreference = "Stop"

$repos = @("hllous/Backend-M6-DAPS2", "hllous/Frontend-M6-DAPS2")
$branches = @("main", "test", "develop")
$failed = @()

foreach ($repo in $repos) {
  foreach ($branch in $branches) {
    # En develop no se exige code owner; en main/test sí.
    $codeOwner = if ($branch -eq "develop") { $false } else { $true }

    $body = [ordered]@{
      required_status_checks = [ordered]@{
        strict   = $true
        contexts = @("build", "test")
      }
      enforce_admins = $false
      required_pull_request_reviews = [ordered]@{
        dismiss_stale_reviews           = $true
        require_code_owner_reviews      = $codeOwner
        required_approving_review_count = 1
        require_last_push_approval      = $true
      }
      restrictions = $null
      required_linear_history          = $true
      allow_force_pushes               = $false
      allow_deletions                  = $false
      required_conversation_resolution = $true
    } | ConvertTo-Json -Depth 8

    Write-Host "==> Aplicando proteccion a $repo / $branch" -ForegroundColor Cyan

    # Se escribe a un archivo temporal (UTF-8 sin BOM) en vez de pipear el
    # JSON directo a `gh api --input -`: en Windows PowerShell 5.1 ese pipe
    # corrompe el body y `gh` responde HTTP 400 sin que el script lo note.
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
      [System.IO.File]::WriteAllText($tmpFile, $body, [System.Text.UTF8Encoding]::new($false))
      gh api --method PUT "repos/$repo/branches/$branch/protection" --input $tmpFile | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Write-Host "    FALLÓ (exit $LASTEXITCODE)" -ForegroundColor Red
        $failed += "$repo / $branch"
      } else {
        Write-Host "    OK" -ForegroundColor Green
      }
    } finally {
      Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }
  }
}

if ($failed.Count -gt 0) {
  Write-Host "`nTerminado con errores en:" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}

Write-Host "`nListo. Branch protection aplicada." -ForegroundColor Green
