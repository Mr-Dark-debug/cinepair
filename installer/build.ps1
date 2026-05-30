<#
.SYNOPSIS
    CinePair Full Release Build & Package Pipeline

.DESCRIPTION
    Builds, packages, and collects all release installers for CinePair.
    Windows artifacts are compiled locally. macOS and Linux artifacts are
    built via GitHub Actions (triggered automatically by a git tag push).

.PARAMETER Version
    The release version (e.g., 0.2.0). If omitted, prompts interactively.

.PARAMETER SkipBuild
    Skip the local Tauri build. Useful for collecting artifacts only.

.PARAMETER SkipGitTag
    Build locally but don't push a git tag (no CI trigger).

.PARAMETER SkipDownload
    Skip downloading cross-platform artifacts from GitHub.

.EXAMPLE
    .\build.ps1
    .\build.ps1 -Version 0.2.0
    .\build.ps1 -SkipBuild
    .\build.ps1 -SkipGitTag
#>

param(
    [string]$Version,
    [switch]$SkipBuild,
    [switch]$SkipGitTag,
    [switch]$SkipDownload
)

# ---------------------------------------------------------------------------
# 0. Configuration & Paths
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ProjectRoot     = Resolve-Path (Join-Path $PSScriptRoot "..")
$TauriConf       = Join-Path $ProjectRoot "src-tauri\tauri.conf.json"
$PackageJson     = Join-Path $ProjectRoot "package.json"
$CargoToml       = Join-Path $ProjectRoot "src-tauri\Cargo.toml"
$InstallerRoot   = $PSScriptRoot
$GithubRepo      = "Mr-Dark-debug/cinepair"

# Load environment variables from .env and .env.local if present
$envPaths = @(Join-Path $ProjectRoot ".env", Join-Path $ProjectRoot ".env.local")
foreach ($path in $envPaths) {
    if (Test-Path $path) {
        Get-Content $path | Where-Object { $_ -match '^\s*[^#\s]+=' } | ForEach-Object {
            $name, $value = $_.Split('=', 2)
            $name = $name.Trim()
            $value = $value.Trim().Trim('"').Trim("'")
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
function Write-Banner {
    param([string]$Text, [string]$Color = "Cyan")
    $line = "=" * 70
    Write-Host ""
    Write-Host $line -ForegroundColor $Color
    Write-Host "  $Text" -ForegroundColor $Color
    Write-Host $line -ForegroundColor $Color
    Write-Host ""
}

function Write-Step {
    param([int]$Num, [string]$Text)
    Write-Host "  [$Num] " -ForegroundColor DarkCyan -NoNewline
    Write-Host $Text -ForegroundColor White
}

function Write-OK {
    param([string]$Text)
    Write-Host "      [OK] $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "      [!!] $Text" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Text)
    Write-Host "      [XX] $Text" -ForegroundColor Red
}

function Write-Detail {
    param([string]$Text)
    Write-Host "        $Text" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# 1. Resolve Version
# ---------------------------------------------------------------------------
Clear-Host
Write-Banner "CinePair Release Build and Package Pipeline"

Write-Step 1 "Resolving release version..."

# Read current version from tauri.conf.json
$tauriConfContent = Get-Content $TauriConf -Raw | ConvertFrom-Json
$currentVersion = $tauriConfContent.version
Write-Detail "Current version in tauri.conf.json: v$currentVersion"

if (-not $Version) {
    Write-Host ""
    Write-Host "      Enter the release version " -NoNewline -ForegroundColor White
    Write-Host "(press Enter for $currentVersion)" -NoNewline -ForegroundColor DarkGray
    Write-Host ": " -NoNewline -ForegroundColor White
    $inputVersion = Read-Host
    if ([string]::IsNullOrWhiteSpace($inputVersion)) {
        $Version = $currentVersion
        Write-OK "Using current version: v$Version"
    } else {
        $Version = $inputVersion.TrimStart("v")
        Write-OK "Using specified version: v$Version"
    }
} else {
    $Version = $Version.TrimStart("v")
    Write-OK "Using CLI-provided version: v$Version"
}

# Validate version format (semver: X.Y.Z)
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Err "Invalid version format '$Version'. Expected format: X.Y.Z (e.g., 0.1.0)"
    exit 1
}

# Create the versioned output directory
$ReleaseDir = Join-Path $InstallerRoot "v$Version"
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
}
Write-OK "Release output folder: installer\v$Version\"

# ---------------------------------------------------------------------------
# 2. Bump Version in Config Files (if changed)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step 2 "Synchronizing version across project config files..."

$versionChanged = $false

# Update tauri.conf.json
if ($tauriConfContent.version -ne $Version) {
    $tauriRaw = Get-Content $TauriConf -Raw
    $tauriRaw = $tauriRaw -replace "`"version`":\s*`"[^`"]+`"", "`"version`": `"$Version`""
    Set-Content -Path $TauriConf -Value $tauriRaw -NoNewline
    Write-OK "Updated tauri.conf.json -> v$Version"
    $versionChanged = $true
} else {
    Write-Detail "tauri.conf.json already at v$Version (no change)"
}

# Update package.json
$pkgContent = Get-Content $PackageJson -Raw
if ($pkgContent -match "`"version`":\s*`"([^`"]+)`"") {
    $pkgVersion = $Matches[1]
    if ($pkgVersion -ne $Version) {
        $pkgContent = $pkgContent -replace "`"version`":\s*`"[^`"]+`"", "`"version`": `"$Version`""
        Set-Content -Path $PackageJson -Value $pkgContent -NoNewline
        Write-OK "Updated package.json -> v$Version"
        $versionChanged = $true
    } else {
        Write-Detail "package.json already at v$Version (no change)"
    }
}

# Update Cargo.toml (only the [package] section version)
$cargoContent = Get-Content $CargoToml -Raw
if ($cargoContent -match 'version\s*=\s*"([^"]+)"') {
    $cargoVersion = $Matches[1]
    if ($cargoVersion -ne $Version) {
        # Only replace the first occurrence (in [package] section, before [dependencies])
        $cargoContent = $cargoContent -replace '(^\[package\][\s\S]*?)version\s*=\s*"[^"]+"', "`${1}version = `"$Version`""
        Set-Content -Path $CargoToml -Value $cargoContent -NoNewline
        Write-OK "Updated Cargo.toml -> v$Version"
        $versionChanged = $true
    } else {
        Write-Detail "Cargo.toml already at v$Version (no change)"
    }
}

if (-not $versionChanged) {
    Write-Detail "All config files already at v$Version. No changes needed."
}

# ---------------------------------------------------------------------------
# 3. Build Windows Installers Locally
# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host ""
    Write-Step 3 "Building Windows installers (Tauri production build)..."
    Write-Detail "Applying SAC/AppLocker workaround (CARGO_TARGET_DIR -> AppData\Local\Temp)"

    $tempTarget = "$env:USERPROFILE\AppData\Local\Temp\cargo-target"
    $env:CARGO_TARGET_DIR = $tempTarget

    Push-Location $ProjectRoot
    try {
        & npm run tauri build

        if ($LASTEXITCODE -ne 0) {
            Write-Err "Tauri build failed with exit code $LASTEXITCODE."
            Write-Err "Please resolve Rust/Vite compilation errors above and retry."
            Pop-Location
            exit 1
        }
        Write-OK "Tauri production build completed successfully!"
    } finally {
        Pop-Location
    }

    # -----------------------------------------------------------------------
    # 3b. Collect Windows Build Artifacts
    # -----------------------------------------------------------------------
    Write-Host ""
    Write-Step 4 "Collecting Windows installer artifacts..."

    $searchPaths = @(
        (Join-Path $tempTarget "release\bundle"),
        (Join-Path $ProjectRoot "src-tauri\target\release\bundle")
    )

    $windowsArtifacts = @()

    foreach ($searchPath in $searchPaths) {
        if (-not (Test-Path $searchPath)) { continue }
        Write-Detail "Scanning: $searchPath"

        # MSI Installer
        $msiFiles = Get-ChildItem -Path $searchPath -Filter "*.msi" -Recurse -File -ErrorAction SilentlyContinue
        foreach ($f in $msiFiles) {
            $targetName = "CinePair_${Version}_x64_en-US.msi"
            Copy-Item -Path $f.FullName -Destination (Join-Path $ReleaseDir $targetName) -Force
            $sizeMB = [math]::Round($f.Length / 1MB, 2)
            Write-OK "MSI: $targetName ($sizeMB MB)"
            $windowsArtifacts += $targetName
        }

        # MSI Installer Signature
        $sigFiles = Get-ChildItem -Path $searchPath -Filter "*.msi.sig" -Recurse -File -ErrorAction SilentlyContinue
        foreach ($f in $sigFiles) {
            $targetName = "CinePair_${Version}_x64_en-US.msi.sig"
            Copy-Item -Path $f.FullName -Destination (Join-Path $ReleaseDir $targetName) -Force
            Write-OK "MSI Signature: $targetName"
        }

        # NSIS EXE Installer
        $exeFiles = Get-ChildItem -Path $searchPath -Filter "*.exe" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "*setup*" -or $_.Name -like "*CinePair*" -or $_.Directory.Name -eq "nsis" }
        foreach ($f in $exeFiles) {
            $targetName = "CinePair_${Version}_x64.exe"
            Copy-Item -Path $f.FullName -Destination (Join-Path $ReleaseDir $targetName) -Force
            $sizeMB = [math]::Round($f.Length / 1MB, 2)
            Write-OK "EXE: $targetName ($sizeMB MB)"
            $windowsArtifacts += $targetName
        }
    }

    if ($windowsArtifacts.Count -eq 0) {
        Write-Warn "No Windows installer artifacts found in target directories."
        Write-Warn "Check the Tauri build logs above for errors."
    }
} else {
    Write-Host ""
    Write-Step 3 'Skipping local build (-SkipBuild flag set)'
}

# ---------------------------------------------------------------------------
# 5. Generate Source Code Archives
# ---------------------------------------------------------------------------
Write-Host ""
$stepNum = if ($SkipBuild) { 4 } else { 5 }
Write-Step $stepNum "Generating source code archives..."

Push-Location $ProjectRoot
try {
    # Source code (zip)
    $zipArchive = "Source_code_v${Version}.zip"
    $zipPath    = Join-Path $ReleaseDir $zipArchive
    git archive --format=zip --prefix="cinepair-$Version/" -o $zipPath HEAD *>$null
    if (Test-Path $zipPath) {
        $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
        Write-OK "$zipArchive ($zipSize MB)"
    } else {
        Write-Warn "Failed to create zip archive. Is git installed?"
    }

    # Source code (tar.gz)
    $tarArchive = "Source_code_v${Version}.tar.gz"
    $tarPath    = Join-Path $ReleaseDir $tarArchive
    git archive --format=tar.gz --prefix="cinepair-$Version/" -o $tarPath HEAD *>$null
    if (Test-Path $tarPath) {
        $tarSize = [math]::Round((Get-Item $tarPath).Length / 1MB, 2)
        Write-OK "$tarArchive ($tarSize MB)"
    } else {
        Write-Warn "Failed to create tar.gz archive. Is git installed?"
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 6. Git Tag & Push (triggers GitHub Actions CI for macOS + Linux builds)
# ---------------------------------------------------------------------------
Write-Host ""
$stepNum++
Write-Step $stepNum "Git tag and CI trigger for cross-platform builds..."

if (-not $SkipGitTag) {
    Push-Location $ProjectRoot
    try {
        $tagName = "v$Version"

        # Check if tag already exists locally
        $existingTag = git tag -l $tagName 2>$null
        if ($existingTag) {
            Write-Warn "Tag $tagName already exists locally."
            Write-Host ""
            Write-Host "      Do you want to force-recreate and push the tag? (y/N): " -NoNewline -ForegroundColor Yellow
            $confirm = Read-Host
            if ($confirm -eq "y" -or $confirm -eq "Y") {
                git tag -d $tagName *>$null
                git push origin --delete $tagName *>$null
                Write-Detail "Deleted existing tag $tagName (local + remote)"
            } else {
                Write-Detail "Skipping tag creation. Existing tag preserved."
                $SkipGitTag = $true
            }
        }

        if (-not $SkipGitTag) {
            # Commit version bump changes if any
            $gitStatus = git status --porcelain 2>$null
            if ($gitStatus) {
                Write-Detail "Committing version bump changes..."
                git add -A *>$null
                git commit -m "chore: release version $Version" *>$null
                Write-OK "Committed version bump: chore: release version $Version"
            }

            # Create and push tag
            git tag -a $tagName -m "CinePair v$Version" *>$null
            Write-OK "Created tag: $tagName"

            git push origin main --tags *>$null
            Write-OK "Pushed to origin/main with tag $tagName"
            Write-OK "GitHub Actions CI triggered for macOS + Linux builds!"
            Write-Detail "Monitor progress: https://github.com/$GithubRepo/actions"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Detail 'Skipping git tag (-SkipGitTag flag set)'
    Write-Warn "macOS/Linux builds will NOT be triggered automatically."
    Write-Warn "Push the tag manually: git tag v$Version; git push origin main --tags"
}

# ---------------------------------------------------------------------------
# 7. Download Cross-Platform Artifacts from GitHub Release
# ---------------------------------------------------------------------------
Write-Host ""
$stepNum++

if (-not $SkipDownload -and -not $SkipGitTag) {
    Write-Step $stepNum "Waiting for GitHub Actions to build cross-platform artifacts..."
    Write-Detail "CI builds macOS (Intel + Apple Silicon) and Linux (amd64) installers."
    Write-Detail "This typically takes 10-20 minutes."
    Write-Host ""

    # Check if GitHub CLI is available
    $ghAvailable = $false
    try {
        $null = gh --version 2>$null
        if ($LASTEXITCODE -eq 0) { $ghAvailable = $true }
    } catch {
        $ghAvailable = $false
    }

    if ($ghAvailable) {
        Write-OK "GitHub CLI (gh) detected. Will auto-download artifacts when ready."
        Write-Host ""
        Write-Host "      Wait for CI to finish and download now? (y/N): " -NoNewline -ForegroundColor Yellow
        $waitChoice = Read-Host

        if ($waitChoice -eq "y" -or $waitChoice -eq "Y") {
            Write-Detail "Polling GitHub Actions for release completion..."
            Write-Detail "Press Ctrl+C to abort and download manually later."
            Write-Host ""

            $maxAttempts   = 60   # 60 x 30s = 30 minute max wait
            $pollInterval  = 30   # seconds between checks
            $releaseReady  = $false

            for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
                $elapsed = ($attempt - 1) * $pollInterval
                $elapsedMin = [math]::Floor($elapsed / 60)
                $elapsedSec = $elapsed % 60

                Write-Host "`r      [..] Waiting... (${elapsedMin}m ${elapsedSec}s elapsed) - checking release assets..." -NoNewline -ForegroundColor DarkGray

                try {
                    # Check if the release exists and has assets
                    $releaseJson = gh release view "v$Version" --repo $GithubRepo --json assets 2>$null
                    if ($releaseJson) {
                        $releaseInfo = $releaseJson | ConvertFrom-Json
                        if ($releaseInfo -and $releaseInfo.assets.Count -ge 4) {
                            $releaseReady = $true
                            Write-Host ""
                            Write-OK "Release v$Version is ready with $($releaseInfo.assets.Count) assets!"
                            break
                        }
                    }
                } catch {
                    # Release not ready yet
                }

                Start-Sleep -Seconds $pollInterval
            }

            if ($releaseReady) {
                Write-Host ""
                Write-Detail "Downloading all release assets to installer\v$Version\..."

                # Download all assets from the GitHub release
                Push-Location $ReleaseDir
                try {
                    gh release download "v$Version" --repo $GithubRepo --clobber *>$null
                    Write-OK "Downloaded all release assets!"
                } finally {
                    Pop-Location
                }

                # Rename artifacts to match our naming convention
                Write-Detail "Renaming artifacts to standard naming convention..."

                $renamePatterns = @(
                    @{ Pattern = "*_x64.dmg";       NewName = "CinePair_${Version}_x64.dmg" },
                    @{ Pattern = "*_aarch64.dmg";    NewName = "CinePair_${Version}_aarch64.dmg" },
                    @{ Pattern = "*_universal.dmg";  NewName = "CinePair_${Version}_universal.dmg" },
                    @{ Pattern = "*.AppImage";       NewName = "CinePair_${Version}_amd64.AppImage" },
                    @{ Pattern = "*.deb";            NewName = "cinepair_${Version}_amd64.deb" }
                )

                foreach ($entry in $renamePatterns) {
                    $files = Get-ChildItem -Path $ReleaseDir -Filter $entry.Pattern -File -ErrorAction SilentlyContinue
                    foreach ($f in $files) {
                        if ($f.Name -ne $entry.NewName) {
                            Rename-Item -Path $f.FullName -NewName $entry.NewName -Force -ErrorAction SilentlyContinue
                            Write-Detail "Renamed: $($f.Name) -> $($entry.NewName)"
                        }
                    }
                }
            } else {
                Write-Warn "Timed out waiting for GitHub Actions. Builds may still be running."
                Write-Warn "Download manually later with:"
                Write-Host "        gh release download v$Version --repo $GithubRepo --dir `"$ReleaseDir`"" -ForegroundColor DarkYellow
            }
        } else {
            Write-Detail "Skipping automatic download."
            Write-Detail "Download later with:"
            Write-Host "        gh release download v$Version --repo $GithubRepo --dir `"$ReleaseDir`"" -ForegroundColor DarkYellow
        }
    } else {
        Write-Warn "GitHub CLI (gh) not found. Cannot auto-download cross-platform artifacts."
        Write-Detail "Install it: winget install GitHub.cli"
        Write-Detail "Or download manually from: https://github.com/$GithubRepo/releases/tag/v$Version"
    }
} else {
    Write-Step $stepNum "Skipping artifact download."
    if ($SkipGitTag) {
        Write-Detail "No tag was pushed, so no CI artifacts will be available."
    }
}

# ---------------------------------------------------------------------------
# 7.5. Generate latest.json for Tauri Auto-Updater
# ---------------------------------------------------------------------------
Write-Host ""
$stepNum++
Write-Step $stepNum "Generating latest.json updater manifest..."

$pubDate = [System.DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$platformsObj = @{}

# Windows (MSI)
$msiFileName = "CinePair_${Version}_x64_en-US.msi"
$msiPath = Join-Path $ReleaseDir $msiFileName
if (Test-Path $msiPath) {
    $msiSigPath = Join-Path $ReleaseDir "${msiFileName}.sig"
    $signature = ""
    if (Test-Path $msiSigPath) {
        $signature = (Get-Content -Path $msiSigPath -Raw).Trim()
        Write-Detail "Found signature for Windows MSI"
    } else {
        Write-Warn "No signature (.sig) file found for Windows MSI."
        Write-Warn "Updater requires code signing. You can manually populate the signature later in latest.json."
    }

    $platformsObj["windows-x86_64"] = @{
        url = "https://github.com/$GithubRepo/releases/download/v$Version/$msiFileName"
        signature = $signature
    }
}

# macOS DMG (Intel)
$dmgIntelName = "CinePair_${Version}_x64.dmg"
$dmgIntelPath = Join-Path $ReleaseDir $dmgIntelName
if (Test-Path $dmgIntelPath) {
    $dmgIntelSigPath = Join-Path $ReleaseDir "${dmgIntelName}.sig"
    $signature = ""
    if (Test-Path $dmgIntelSigPath) {
        $signature = (Get-Content -Path $dmgIntelSigPath -Raw).Trim()
        Write-Detail "Found signature for macOS DMG (Intel)"
    }
    $platformsObj["darwin-x86_64"] = @{
        url = "https://github.com/$GithubRepo/releases/download/v$Version/$dmgIntelName"
        signature = $signature
    }
}

# macOS DMG (Apple Silicon)
$dmgArmName = "CinePair_${Version}_aarch64.dmg"
$dmgArmPath = Join-Path $ReleaseDir $dmgArmName
if (Test-Path $dmgArmPath) {
    $dmgArmSigPath = Join-Path $ReleaseDir "${dmgArmName}.sig"
    $signature = ""
    if (Test-Path $dmgArmSigPath) {
        $signature = (Get-Content -Path $dmgArmSigPath -Raw).Trim()
        Write-Detail "Found signature for macOS DMG (Apple Silicon)"
    }
    $platformsObj["darwin-aarch64"] = @{
        url = "https://github.com/$GithubRepo/releases/download/v$Version/$dmgArmName"
        signature = $signature
    }
}

# Linux AppImage
$appImageName = "CinePair_${Version}_amd64.AppImage"
$appImagePath = Join-Path $ReleaseDir $appImageName
if (Test-Path $appImagePath) {
    $appImageSigPath = Join-Path $ReleaseDir "${appImageName}.sig"
    $signature = ""
    if (Test-Path $appImageSigPath) {
        $signature = (Get-Content -Path $appImageSigPath -Raw).Trim()
        Write-Detail "Found signature for Linux AppImage"
    }
    $platformsObj["linux-x86_64"] = @{
        url = "https://github.com/$GithubRepo/releases/download/v$Version/$appImageName"
        signature = $signature
    }
}

# Construct the full JSON object
$updaterJson = [ordered]@{
    version  = "v$Version"
    notes    = "CinePair Release v$Version"
    pub_date = $pubDate
    platforms = $platformsObj
}

# Convert to JSON string and write to file
$updaterJsonStr = $updaterJson | ConvertTo-Json -Depth 100
$updaterJsonPath = Join-Path $ReleaseDir "latest.json"
Set-Content -Path $updaterJsonPath -Value $updaterJsonStr -Encoding utf8
Write-OK "Generated latest.json inside installer\v$Version\"

# ---------------------------------------------------------------------------
# 8. Final Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Banner "Release v$Version - Build Summary" "Green"

# List all files in the release directory
$allFiles = Get-ChildItem -Path $ReleaseDir -File -ErrorAction SilentlyContinue | Sort-Object Name
if ($allFiles.Count -gt 0) {
    Write-Host "  Release artifacts in: installer\v$Version\" -ForegroundColor White
    Write-Host ""

    # Table header
    $headerFormat = "  {0,-50} {1,12} {2,-10}"
    Write-Host ($headerFormat -f "Filename", "Size", "Platform") -ForegroundColor DarkCyan
    Write-Host ("  " + "-" * 72) -ForegroundColor DarkGray

    foreach ($file in $allFiles) {
        $size = if ($file.Length -ge 1MB) {
            "$([math]::Round($file.Length / 1MB, 1)) MB"
        } elseif ($file.Length -ge 1KB) {
            "$([math]::Round($file.Length / 1KB, 1)) KB"
        } else {
            "$($file.Length) B"
        }

        $platform = switch -Wildcard ($file.Name) {
            "*.msi"       { "Windows" }
            "*.exe"       { "Windows" }
            "*.dmg"       { "macOS" }
            "*.AppImage"  { "Linux" }
            "*.deb"       { "Linux" }
            "*.zip"       { "Source" }
            "*.tar.gz"    { "Source" }
            "*.json"      { "Updater" }
            "*.sig"       { "Signature" }
            default       { "Other" }
        }

        $color = switch ($platform) {
            "Windows"   { "Cyan" }
            "macOS"     { "Magenta" }
            "Linux"     { "Yellow" }
            "Source"    { "DarkGray" }
            "Updater"   { "DarkGray" }
            "Signature" { "DarkGray" }
            default     { "White" }
        }

        Write-Host ("  {0,-50} " -f $file.Name) -NoNewline -ForegroundColor $color
        Write-Host ("{0,12} " -f $size) -NoNewline -ForegroundColor White
        Write-Host ("{0,-10}" -f $platform) -ForegroundColor $color
    }

    Write-Host ""
    Write-Host "  Total: $($allFiles.Count) file(s)" -ForegroundColor White
} else {
    Write-Warn "No artifacts found in release directory yet."
}

# Expected asset checklist
Write-Host ""
Write-Host "  Expected Release Assets Checklist:" -ForegroundColor White
Write-Host ""
$expected = @(
    @{ File = "CinePair_${Version}_x64_en-US.msi";  Desc = "Windows MSI Installer (64-bit)";        Platform = "Windows" },
    @{ File = "CinePair_${Version}_x64.exe";         Desc = "Windows Standalone EXE Installer";      Platform = "Windows" },
    @{ File = "CinePair_${Version}_x64.dmg";         Desc = "macOS DMG (Intel)";                     Platform = "macOS" },
    @{ File = "CinePair_${Version}_aarch64.dmg";     Desc = "macOS DMG (Apple Silicon M1/M2/M3)";    Platform = "macOS" },
    @{ File = "CinePair_${Version}_amd64.AppImage";  Desc = "Linux Portable AppImage";               Platform = "Linux" },
    @{ File = "cinepair_${Version}_amd64.deb";       Desc = "Debian/Ubuntu Package";                 Platform = "Linux" },
    @{ File = "Source_code_v${Version}.zip";          Desc = "Source Archive (ZIP)";                  Platform = "Source" },
    @{ File = "Source_code_v${Version}.tar.gz";       Desc = "Source Archive (tar.gz)";               Platform = "Source" }
)

foreach ($item in $expected) {
    $exists = Test-Path (Join-Path $ReleaseDir $item.File)
    if ($exists) {
        $icon = "[OK]"
        $color = "Green"
    } else {
        $icon = "[ ]"
        $color = "DarkGray"
    }
    Write-Host "     $icon " -NoNewline -ForegroundColor $color
    Write-Host "$($item.File)" -NoNewline -ForegroundColor $color
    Write-Host " - $($item.Desc)" -ForegroundColor DarkGray
}

Write-Host ""

if (-not $SkipGitTag) {
    Write-Host "  GitHub Release: " -NoNewline -ForegroundColor White
    Write-Host "https://github.com/$GithubRepo/releases/tag/v$Version" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  CI Build Status: " -NoNewline -ForegroundColor White
    Write-Host "https://github.com/$GithubRepo/actions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  Upload all [OK] files from installer\v$Version\ to your GitHub Release!" -ForegroundColor Green
Write-Host ""
