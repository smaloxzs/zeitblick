@echo off
rem ============================================================
rem  Zeitblick: Autostart wieder entfernen
rem  (Der Tracker laeuft dann nicht mehr automatisch beim Booten.
rem   Bereits gesammelte Daten bleiben erhalten.)
rem ============================================================
setlocal
set "ZB_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Zeitblick Tracker.lnk"

if exist "%ZB_LNK%" (
    del "%ZB_LNK%"
    echo Autostart entfernt. Zeitblick startet nicht mehr automatisch.
) else (
    echo Kein Autostart-Eintrag gefunden - nichts zu tun.
)
echo.
echo Hinweis: Ein evtl. gerade laufender Tracker laeuft weiter, bis du ihn
echo mit stop-tracker.cmd beendest oder den PC neu startest.
timeout /t 4 >nul
