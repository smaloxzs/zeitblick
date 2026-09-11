@echo off
rem ============================================================
rem  Zeitblick als App oeffnen
rem  Stellt sicher, dass der Tracker laeuft, und oeffnet das
rem  Dashboard in einem eigenen App-Fenster (ohne Adressleiste/Tabs).
rem ============================================================
setlocal
cd /d "%~dp0"

rem Tracker sicherstellen - der Port-Check im Tracker verhindert Doppelstart
set "PYW="
for /f "delims=" %%i in ('where pythonw 2^>nul') do set "PYW=%%i"
if defined PYW start "" "%PYW%" "%CD%\tracker.py"

rem kurz warten, bis der Server bereit ist
timeout /t 2 >nul

set "URL=http://localhost:8771"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

rem Im App-Modus oeffnen: eigenes Fenster, das wie eine native App aussieht
if exist "%EDGE%" (
    start "" "%EDGE%" --app=%URL% --window-size=1280,860
) else if exist "%CHROME%" (
    start "" "%CHROME%" --app=%URL% --window-size=1280,860
) else if exist "%CHROME2%" (
    start "" "%CHROME2%" --app=%URL% --window-size=1280,860
) else (
    start "" %URL%
)
