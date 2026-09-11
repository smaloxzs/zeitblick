@echo off
rem ============================================================
rem  Zeitblick: Autostart einrichten
rem  Legt eine Verknuepfung in den Windows-Autostart-Ordner, die
rem  den Tracker bei jeder Anmeldung unsichtbar (pythonw) startet.
rem ============================================================
setlocal
cd /d "%~dp0"

rem pythonw.exe suchen (startet ohne sichtbares Fenster)
set "PYW="
for /f "delims=" %%i in ('where pythonw 2^>nul') do set "PYW=%%i"
if not defined PYW (
    echo FEHLER: pythonw.exe wurde nicht gefunden.
    echo Bitte Python installieren ^(python.org^) und erneut versuchen.
    echo.
    pause
    exit /b 1
)

set "ZB_TARGET=%PYW%"
set "ZB_SCRIPT=%CD%\tracker.py"
set "ZB_WORKDIR=%CD%"
set "ZB_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Zeitblick Tracker.lnk"

rem Verknuepfung im Autostart-Ordner anlegen (Werte via Umgebungsvariablen,
rem damit Leerzeichen/Anfuehrungszeichen sauber uebergeben werden)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:ZB_LNK); $s.TargetPath=$env:ZB_TARGET; $s.Arguments='\"'+$env:ZB_SCRIPT+'\"'; $s.WorkingDirectory=$env:ZB_WORKDIR; $s.WindowStyle=7; $s.Description='Zeitblick Aktivitaets-Tracker'; $s.Save()"

if errorlevel 1 (
    echo FEHLER beim Anlegen der Verknuepfung.
    pause
    exit /b 1
)

echo ============================================================
echo  Autostart eingerichtet.
echo  Der Tracker startet ab jetzt bei jedem Hochfahren automatisch
echo  und laeuft unsichtbar im Hintergrund.
echo.
echo  Verknuepfung: "%ZB_LNK%"
echo ============================================================
echo.

rem Tracker gleich jetzt starten (falls noch nicht aktiv - Port-Check im Tracker
rem sorgt dafuer, dass es nie doppelt laeuft)
start "" "%PYW%" "%ZB_SCRIPT%"
echo Tracker laeuft jetzt. Dashboard: http://localhost:8771
timeout /t 4 >nul
