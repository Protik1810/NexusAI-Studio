param(
    [string]$InstallPath = "$env:LOCALAPPDATA\Programs\NexusAI Studio"
)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   Installing NexusAI Studio v1.0.0              " -ForegroundColor White
Write-Host "   Created by Protik                             " -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan

$SourceDir = "D:\genimg_comic\release-pkg\NexusAI Studio-win32-x64"

if (!(Test-Path $SourceDir)) {
    Write-Error "Source build not found in $SourceDir"
    exit 1
}

Write-Host "[1/4] Creating installation directory in $InstallPath..." -ForegroundColor Green
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

Write-Host "[2/4] Copying NexusAI Studio application files..." -ForegroundColor Green
Copy-Item -Path "$SourceDir\*" -Destination $InstallPath -Recurse -Force

Write-Host "[3/4] Creating Desktop Shortcut..." -ForegroundColor Green
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$DesktopShortcut = $WshShell.CreateShortcut("$DesktopPath\NexusAI Studio.lnk")
$DesktopShortcut.TargetPath = "$InstallPath\NexusAI Studio.exe"
$DesktopShortcut.WorkingDirectory = $InstallPath
$DesktopShortcut.IconLocation = "$InstallPath\resources\app\electron\icon.ico"
$DesktopShortcut.Description = "NexusAI Studio — Sovereign Generative AI Workstation by Protik"
$DesktopShortcut.Save()

Write-Host "[4/4] Creating Start Menu Shortcut..." -ForegroundColor Green
$StartMenuPath = [System.Environment]::GetFolderPath('StartMenu') + "\Programs"
$StartShortcut = $WshShell.CreateShortcut("$StartMenuPath\NexusAI Studio.lnk")
$StartShortcut.TargetPath = "$InstallPath\NexusAI Studio.exe"
$StartShortcut.WorkingDirectory = $InstallPath
$StartShortcut.IconLocation = "$InstallPath\resources\app\electron\icon.ico"
$StartShortcut.Description = "NexusAI Studio — Sovereign Generative AI Workstation by Protik"
$StartShortcut.Save()

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Installation Complete!                           " -ForegroundColor Green
Write-Host " Launching NexusAI Studio now...                  " -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan

Start-Process "$InstallPath\NexusAI Studio.exe"