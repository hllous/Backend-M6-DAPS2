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
#   powershell -ExecutionPolicy Bypass -File apply-branch-protection.ps1
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
    $body | gh api --method PUT "repos/$repo/branches/$branch/protection" --input - | Out-Null
    Write-Host "    OK" -ForegroundColor Green
  }
}

Write-Host "`nListo. Branch protection aplicada." -ForegroundColor Green
