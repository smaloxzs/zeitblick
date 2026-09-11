#!/usr/bin/env python3
"""
Zeitblick - lokaler Aktivitaets-Tracker (Rize-Nachbau) fuer Windows.

Macht zwei Dinge gleichzeitig:
  1. Trackt alle 5 Sekunden, welches Programm im Vordergrund ist
     (nur Fenster-Metadaten: Prozessname + Fenstertitel - keine Screenshots,
     kein Keylogging, alles bleibt lokal auf diesem PC).
  2. Liefert das Dashboard unter http://localhost:8771 aus.

Benoetigt nur die Python-Standardbibliothek (keine pip-Pakete).
Start (sichtbar):    start-tracker.cmd   (oder: python tracker.py)
Start (unsichtbar):  pythonw tracker.py  (kein Fenster, fuer Autostart)
Autostart einrichten: install-autostart.cmd
Als App oeffnen:     Zeitblick.cmd
Stop:                stop-tracker.cmd

Daten liegen als JSON pro Tag in  data/JJJJ-MM-TT.json
"""

import atexit
import ctypes
import json
import os
import sys
import threading
import time
from ctypes import wintypes
from datetime import datetime, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PID_FILE = os.path.join(BASE_DIR, "zeitblick.pid")

PORT = 8771
POLL_INTERVAL = 5        # Sekunden zwischen zwei Messungen
IDLE_LIMIT = 180         # ab 3 Min. ohne Maus/Tastatur gilt man als abwesend
FLUSH_INTERVAL = 20      # wie oft auf die Platte geschrieben wird
MIN_SESSION_SECONDS = 2  # kuerzere Sessions werden verworfen
TITLE_MAX_LEN = 150
KEEP_DAYS = 0            # 0 = Daten fuer immer behalten; z. B. 365 = nur letztes Jahr

# Prozesse, die nie getrackt werden (Sperrbildschirm etc.)
IGNORE_APPS = {"lockapp.exe", "logonui.exe", ""}

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]


def idle_seconds():
    """Sekunden seit der letzten Maus-/Tastatureingabe."""
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if not user32.GetLastInputInfo(ctypes.byref(lii)):
        return 0.0
    return max(0.0, (kernel32.GetTickCount() - lii.dwTime) / 1000.0)


def foreground_info():
    """(exe-name, fenstertitel) des Vordergrund-Fensters oder None."""
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    pid = wintypes.DWORD(0)
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return None

    exe = ""
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
    if handle:
        try:
            buf = ctypes.create_unicode_buffer(1024)
            size = wintypes.DWORD(1024)
            if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                exe = os.path.basename(buf.value).lower()
        finally:
            kernel32.CloseHandle(handle)
    if not exe:
        return None

    title = ""
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        tbuf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, tbuf, length + 1)
        title = tbuf.value
    return exe, title.strip()[:TITLE_MAX_LEN]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


class Tracker:
    """Sammelt Sessions ({app, title, start, end}) und schreibt sie pro Tag als JSON."""

    def __init__(self):
        self.lock = threading.Lock()
        self.day = datetime.now().date()
        self.sessions = self._load(self.day)
        self.current = None
        self.last_poll = datetime.now()

    def _day_file(self, day):
        return os.path.join(DATA_DIR, day.isoformat() + ".json")

    def _load(self, day):
        try:
            with open(self._day_file(day), "r", encoding="utf-8") as f:
                return json.load(f).get("sessions", [])
        except (OSError, ValueError):
            return []

    def _close_current(self, now, idle=0.0):
        cur = self.current
        if not cur:
            return
        self.current = None
        start = datetime.strptime(cur["start"], "%Y-%m-%dT%H:%M:%S")
        end = datetime.strptime(cur["end"], "%Y-%m-%dT%H:%M:%S")
        if idle > 0:
            # Bei Abwesenheit: Session endet, als die letzte Eingabe kam
            cutoff = now - timedelta(seconds=idle)
            end = max(start, min(end, cutoff))
        if end <= start:
            # nur einmal gemessen -> zaehlt ungefaehr ein Poll-Intervall
            end = start + timedelta(seconds=POLL_INTERVAL)
        if (end - start).total_seconds() >= MIN_SESSION_SECONDS:
            cur["end"] = iso(end)
            self.sessions.append(cur)

    def poll(self):
        now = datetime.now()
        with self.lock:
            # Tageswechsel: alten Tag abschliessen, neuen beginnen
            if now.date() != self.day:
                self._close_current(now)
                self._write_locked()
                self.day = now.date()
                self.sessions = self._load(self.day)

            # Bei Rechner-Standby o.ae. keine Luecke ueberbruecken
            gap = (now - self.last_poll).total_seconds()
            self.last_poll = now

            idle = idle_seconds()
            info = foreground_info()

            if idle >= IDLE_LIMIT:
                self._close_current(now, idle=idle)
                return
            if info is None or info[0] in IGNORE_APPS:
                self._close_current(now)
                return

            exe, title = info
            if (
                self.current
                and self.current["app"] == exe
                and self.current["title"] == title
                and gap < POLL_INTERVAL * 3
            ):
                self.current["end"] = iso(now)
            else:
                self._close_current(now)
                self.current = {"app": exe, "title": title, "start": iso(now), "end": iso(now)}

    def _write_locked(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        sessions = list(self.sessions)
        if self.current:
            live = dict(self.current)
            if live["end"] == live["start"]:
                live["end"] = iso(
                    datetime.strptime(live["start"], "%Y-%m-%dT%H:%M:%S")
                    + timedelta(seconds=POLL_INTERVAL)
                )
            sessions.append(live)
        payload = {
            "date": self.day.isoformat(),
            "generated": iso(datetime.now()),
            "sessions": sessions,
        }
        path = self._day_file(self.day)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.replace(tmp, path)

    def flush(self):
        with self.lock:
            self._write_locked()


def tracking_loop(tracker):
    last_flush = 0.0
    while True:
        try:
            tracker.poll()
            if time.time() - last_flush >= FLUSH_INTERVAL:
                tracker.flush()
                last_flush = time.time()
        except Exception as exc:  # Tracker darf nie sterben
            print("Tracker-Fehler:", exc, file=sys.stderr)
        time.sleep(POLL_INTERVAL)


_singleton_handle = None


def acquire_singleton():
    """True, wenn wir die einzige Instanz sind. Verhindert (anders als ein
    reiner Port-Check, den Windows via SO_REUSEADDR umgehen kann) zuverlaessig,
    dass zwei Tracker gleichzeitig in dieselben Dateien schreiben."""
    global _singleton_handle
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    _singleton_handle = kernel32.CreateMutexW(None, False, "ZeitblickTrackerSingleton")
    ERROR_ALREADY_EXISTS = 183
    return ctypes.get_last_error() != ERROR_ALREADY_EXISTS


class QuietServer(ThreadingHTTPServer):
    allow_reuse_address = False  # zweiter Bind auf denselben Port soll scheitern
    daemon_threads = True


def prune_old_data():
    """Loescht Tagesdateien aelter als KEEP_DAYS (0 = nie loeschen)."""
    if KEEP_DAYS <= 0 or not os.path.isdir(DATA_DIR):
        return
    cutoff = (datetime.now() - timedelta(days=KEEP_DAYS)).date()
    for name in os.listdir(DATA_DIR):
        if not name.endswith(".json"):
            continue
        try:
            day = datetime.strptime(name[:-5], "%Y-%m-%d").date()
        except ValueError:
            continue
        if day < cutoff:
            try:
                os.remove(os.path.join(DATA_DIR, name))
            except OSError:
                pass


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # keine Request-Logs in der Konsole


def main():
    if os.name != "nt":
        sys.exit("Zeitblick laeuft nur unter Windows.")

    if not acquire_singleton():
        print("Zeitblick laeuft bereits - diese Instanz beendet sich.")
        print(f"Dashboard: http://localhost:{PORT}")
        return

    try:
        httpd = QuietServer(("127.0.0.1", PORT), partial(Handler, directory=BASE_DIR))
    except OSError:
        print(f"Zeitblick laeuft offenbar schon (Port {PORT} ist belegt).")
        print(f"Dashboard: http://localhost:{PORT}")
        return

    with open(PID_FILE, "w", encoding="utf-8") as f:
        f.write(str(os.getpid()))
    atexit.register(lambda: os.path.exists(PID_FILE) and os.remove(PID_FILE))

    prune_old_data()
    tracker = Tracker()
    atexit.register(tracker.flush)
    threading.Thread(target=tracking_loop, args=(tracker,), daemon=True).start()

    print("Zeitblick laeuft.")
    print(f"  Dashboard:  http://localhost:{PORT}")
    print(f"  Daten:      {DATA_DIR}")
    print("  Beenden:    stop-tracker.cmd oder Strg+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        tracker.flush()


if __name__ == "__main__":
    main()
