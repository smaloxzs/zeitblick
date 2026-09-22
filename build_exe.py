#!/usr/bin/env python3
"""
Baut Zeitblick als einzelne, selbstinstallierende Windows-.exe.

Voraussetzung: pip install pyinstaller  (nur zum Bauen noetig, nicht fuer
den Endnutzer - die fertige .exe enthaelt alles Noetige selbst).

Aufruf:  python build_exe.py
Ergebnis: dist/Zeitblick.exe
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    sep = ";" if os.name == "nt" else ":"
    args = [
        sys.executable, "-m", "PyInstaller",
        "--name", "Zeitblick",
        "--onefile",
        "--noconsole",
        "--noupx",
        "--icon", os.path.join(HERE, "zeitblick.ico"),
        "--version-file", os.path.join(HERE, "version_info.txt"),
        "--add-data", f"{os.path.join(HERE, 'index.html')}{sep}.",
        "--add-data", f"{os.path.join(HERE, 'style.css')}{sep}.",
        "--add-data", f"{os.path.join(HERE, 'app.js')}{sep}.",
        "--add-data", f"{os.path.join(HERE, 'categories.json')}{sep}.",
        "--distpath", os.path.join(HERE, "dist"),
        "--workpath", os.path.join(HERE, "build"),
        "--specpath", HERE,
        "--noconfirm",
        os.path.join(HERE, "tracker.py"),
    ]
    print("Baue Zeitblick.exe ...")
    subprocess.run(args, check=True)
    print("\nFertig:", os.path.join(HERE, "dist", "Zeitblick.exe"))


if __name__ == "__main__":
    main()
