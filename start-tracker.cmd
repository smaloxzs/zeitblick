@echo off
rem Startet den Zeitblick-Tracker unsichtbar im Hintergrund.
cd /d "%~dp0"

where pythonw >nul 2>&1
if %errorlevel%==0 (
    start "" pythonw tracker.py
) else (
    start "Zeitblick Tracker" /min python tracker.py
)

echo Zeitblick-Tracker gestartet.
echo Dashboard: http://localhost:8771
timeout /t 3 >nul
start "" http://localhost:8771
