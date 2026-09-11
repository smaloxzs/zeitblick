@echo off
rem ============================================================
rem  Zeitblick: Verknuepfung auf den Desktop legen
rem  (Doppelklick auf das Desktop-Icon oeffnet den Tracker.)
rem ============================================================
setlocal
cd /d "%~dp0"

set "ZB_TARGET=%CD%\Zeitblick.cmd"
set "ZB_WORKDIR=%CD%"
set "ZB_ICON=%CD%\zeitblick.ico"
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%d"
set "ZB_LNK=%DESKTOP%\Zeitblick.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:ZB_LNK); $s.TargetPath=$env:ZB_TARGET; $s.WorkingDirectory=$env:ZB_WORKDIR; if (Test-Path $env:ZB_ICON) { $s.IconLocation=$env:ZB_ICON }; $s.WindowStyle=7; $s.Description='Zeitblick Aktivitaets-Tracker oeffnen'; $s.Save()"

if exist "%ZB_LNK%" (
    echo Fertig! Auf dem Desktop liegt jetzt das Icon "Zeitblick".
    echo Doppelklick darauf oeffnet den Aktivitaets-Tracker.
) else (
    echo Konnte die Verknuepfung nicht anlegen.
)
timeout /t 4 >nul
