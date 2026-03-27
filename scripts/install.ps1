$ErrorActionPreference = "Stop"

$repo = if ($env:ACORN_INSTALL_REPO) { $env:ACORN_INSTALL_REPO } else { "SzymonKostrubiec/Acorn-FileManager" }
$installDir = if ($env:ACORN_INSTALL_DIR) { $env:ACORN_INSTALL_DIR } else { Join-Path $HOME ".acorn\bin" }

if ($env:PROCESSOR_ARCHITECTURE -match "ARM64") {
    $arch = "arm64"
} else {
    $arch = "x64"
}

$asset = "acorn-win32-$arch.exe"
$url = "https://github.com/$repo/releases/latest/download/$asset"
$target = Join-Path $installDir "acorn.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $target

Write-Host "Installed to $target"
Write-Host "Add $installDir to PATH if needed"
