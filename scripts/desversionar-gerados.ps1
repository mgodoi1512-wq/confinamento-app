# Remove do índice Git somente arquivos atualmente ignorados. Não apaga arquivos do disco.
# Use quando estiver mantendo a pasta antiga. Revise git status depois.
$ErrorActionPreference = "Stop"
$projectPath = Split-Path -Parent $PSScriptRoot
$trackedIgnoredPaths = @(git -C $projectPath -c core.quotepath=false ls-files --cached --ignored --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw "Não foi possível consultar o Git do projeto." }
if ($trackedIgnoredPaths.Count -eq 0) {
    Write-Host "Nenhum arquivo ignorado continua versionado."
} else {
    foreach ($trackedPath in $trackedIgnoredPaths) {
        git -C $projectPath rm --cached --ignore-unmatch -- "$trackedPath"
        if ($LASTEXITCODE -ne 0) { throw "Falha ao retirar um arquivo do índice. Revise git status." }
    }
    Write-Host "Arquivos gerados/privados retirados do índice; cópias locais preservadas."
}
git -C $projectPath status --short
