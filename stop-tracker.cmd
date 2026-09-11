@echo off
rem Beendet den Zeitblick-Tracker (ueber die PID-Datei).
cd /d "%~dp0"

if not exist zeitblick.pid (
    echo Kein laufender Tracker gefunden (zeitblick.pid fehlt).
    pause
    exit /b
)

set /p PID=<zeitblick.pid
taskkill /pid %PID% /f >nul 2>&1
if exist zeitblick.pid del zeitblick.pid
echo Zeitblick-Tracker (PID %PID%) beendet.
timeout /t 2 >nul
