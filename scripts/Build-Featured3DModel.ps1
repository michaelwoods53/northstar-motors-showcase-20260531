param(
  [string]$InputRoot = "C:\Users\micha\Documents\Codex\2026-05-31\i-want-to-create-a-new\tools\model-inputs\atlas-ev",
  [string]$OutputRoot = "C:\Users\micha\Documents\Codex\2026-05-31\i-want-to-create-a-new\assets\generated-models\atlas-showcase"
)

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $InputRoot "manifest.json"
$processedRoot = Join-Path $InputRoot "processed"
New-Item -ItemType Directory -Force -Path $processedRoot | Out-Null

$manifest = Get-Content $manifestPath | ConvertFrom-Json
foreach ($view in $manifest.views) {
  $rawPath = Join-Path $InputRoot $view.file
  $processedPath = Join-Path $processedRoot ([System.IO.Path]::GetFileNameWithoutExtension($view.file) + ".png")
  & "$PSScriptRoot\Remove-ChromaKey.ps1" -InputPath $rawPath -OutputPath $processedPath | Out-Null
  $view.file = ".\processed\" + [System.IO.Path]::GetFileName($processedPath)
}

$processedManifestPath = Join-Path $InputRoot "processed-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $processedManifestPath -Encoding UTF8
& "$PSScriptRoot\New-MultiPlaneVehicleModel.ps1" -ManifestPath $processedManifestPath -OutputDir $OutputRoot -ModelFileName "atlas-showcase.gltf"
