@echo off
title NexusAI Studio - Standalone Launcher
cd /d "%~dp0"
echo.
echo  NexusAI Studio  v1.0.0  - Standalone AI Image + Chat Studio
echo.
where npm >nul 2>&1
if errorlevel 1 ( echo [ERROR] npm not found. Install Node.js from https://nodejs.org && pause && exit /b 1 )
echo [NexusAI] Starting backend server...
start /min "" cmd /c "npm run dev"
echo [NexusAI] Waiting for server to start...
set /a tries=0
:waitloop
timeout /t 2 /nobreak >nul
curl -s http://localhost:1420 >nul 2>&1
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% lss 15 goto waitloop
:ready
echo [NexusAI] Server ready! Launching app window...
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist %EDGE% ( start "" %EDGE% --app=http://localhost:1420 --window-size=1440,960 && goto done )
if exist %CHROME% ( start "" %CHROME% --app=http://localhost:1420 --window-size=1440,960 && goto done )
start http://localhost:1420
:done
echo [NexusAI] Running at http://localhost:1420 - Close this window to stop.
pause
