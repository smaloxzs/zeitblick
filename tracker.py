#!/usr/bin/env python3
"""
Zeitblick - lokaler Aktivitaets-Tracker (Rize-Nachbau) fuer Windows.

Macht mehrere Dinge gleichzeitig:
  1. Trackt alle 5 Sekunden, welches Programm im Vordergrund ist
     (nur Fenster-Metadaten: Prozessname + Fenstertitel - keine Screenshots,
     kein Keylogging, alles bleibt lokal auf diesem PC).
  2. Liefert das Dashboard unter http://localhost:8771 aus (inkl. kleiner
     JSON-API unter /api/focus fuer den Fokus-Modus).
  3. Fokus-Modus (Pomodoro-artig): waehrend einer aktiven Sitzung wird das
     Vordergrundfenster gegen eine Sperrliste (Stichwoerter/Programme)
     geprueft; ein Treffer minimiert das Fenster und zeigt eine kleine
     Desktop-Benachrichtigung (per tkinter, das mit Python mitgeliefert
     wird - keine zusaetzliche Installation noetig). Am Ende der Sitzung
     kommt eine Pausen-Erinnerung, danach optional der naechste Block.

Benoetigt nur die Python-Standardbibliothek (keine pip-Pakete).
Start (sichtbar):    start-tracker.cmd   (oder: python tracker.py)
Start (unsichtbar):  pythonw tracker.py  (kein Fenster, fuer Autostart)
Autostart einrichten: install-autostart.cmd
Als App oeffnen:     Zeitblick.cmd
Stop:                stop-tracker.cmd

Daten liegen als JSON pro Tag in  data/JJJJ-MM-TT.json

Als gebaute .exe (siehe build_exe.py) läuft Zeitblick zusätzlich als
selbstinstallierendes Programm: erster Start kopiert sich selbst nach
%LOCALAPPDATA%\\Zeitblick, legt Verknüpfungen an, trägt Autostart + einen
Eintrag unter "Apps & Features" ein. `--uninstall` macht alles rückgängig.
Im normalen Skript-Betrieb (dieser Datei direkt mit `python`/`pythonw`
gestartet) ändert sich am bisherigen Verhalten nichts.
"""

import atexit
import ctypes
import json
import os
import queue
import subprocess
import sys
import threading
import time
import webbrowser
from ctypes import wintypes
from datetime import datetime, timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERSION = "1.1.5"
VERSION_URL = "https://raw.githubusercontent.com/smaloxzs/zeitblick/main/version.json"
APP_NAME = "Zeitblick"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Zeitblick"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def is_frozen():
    return bool(getattr(sys, "frozen", False))


if is_frozen():
    # Gebaute .exe (PyInstaller --onefile): der Prozess laeuft aus einem
    # temporaeren Extraktionsordner, der bei jedem Start neu angelegt wird.
    # Persistente Daten muessen deshalb woanders liegen, sonst wuerden sie
    # bei jedem Neustart der App verloren gehen.
    ASSETS_DIR = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    APP_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), APP_NAME)
    INSTALLED_EXE = os.path.join(APP_DIR, "Zeitblick.exe")
else:
    # Normaler Skript-Betrieb (wie bisher, z. B. bei Marlon per pythonw
    # gestartet): alles bleibt nebeneinander im Projektordner, unveraendert.
    ASSETS_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = ASSETS_DIR
    INSTALLED_EXE = None

BASE_DIR = ASSETS_DIR  # dient dem Webserver: index.html/app.js/style.css liegen hier
DATA_DIR = os.path.join(APP_DIR, "data")
PID_FILE = os.path.join(APP_DIR, "zeitblick.pid")
FOCUS_FILE = os.path.join(APP_DIR, "focus_state.json")

PORT = 8771
POLL_INTERVAL = 5        # Sekunden zwischen zwei Messungen
IDLE_LIMIT = 180         # ab 3 Min. ohne Maus/Tastatur gilt man als abwesend
FLUSH_INTERVAL = 20      # wie oft auf die Platte geschrieben wird
MIN_SESSION_SECONDS = 2  # kuerzere Sessions werden verworfen
TITLE_MAX_LEN = 150
KEEP_DAYS = 0            # 0 = Daten fuer immer behalten; z. B. 365 = nur letztes Jahr
BLOCK_COOLDOWN = 45      # Sek. - so lange wird dieselbe Ablenkung nicht erneut minimiert/gemeldet

# Prozesse, die nie getrackt werden (Sperrbildschirm etc.)
IGNORE_APPS = {"lockapp.exe", "logonui.exe", ""}

# Fokus-Modus: Grundzustand, wird mit einer evtl. vorhandenen focus_state.json
# zusammengefuehrt (siehe load_focus). notify_queue traegt Auftraege von den
# Hintergrund-Threads zum Benachrichtigungs-Thread (der als einziger Tkinter
# anfassen darf).
FOCUS_LOCK = threading.Lock()
notify_queue = queue.Queue()
GLOBAL_TRACKER = None  # wird in main() gesetzt, damit die HTTP-API die
                        # heute schon getrackte Zeit fuers Tagesziel kennt

FOCUS_DEFAULTS = {
    "active": False,
    "mode": "focus",             # "focus" oder "break"
    "end_at": None,              # ISO-Zeitpunkt, wann die aktuelle Phase endet
    "duration_min": 25,
    "break_min": 5,
    "notifications": True,
    "blocking": True,
    # Stichworte werden gegen "exe titel" (klein geschrieben) geprueft -
    # deckt sowohl Programme (steam.exe) als auch Websites im Browser-
    # Fenstertitel (youtube, tiktok, ...) ab.
    "blocked": ["youtube", "tiktok", "instagram", "reddit", "twitter", "x.com",
                "netflix", "twitch", "steam.exe", "spotify.exe"],
    "session_allow": [],         # in dieser Sitzung als "keine Ablenkung" markiert
    "prompted": False,           # wurde fuer die aktuelle Phase schon erinnert?
    "last_block": None,          # {"kw":..., "at": iso} - Cooldown gegen Spam
    "daily_goal_hours": 6,
    "goal_notified_date": None,
    "goal_notified_pct": [],
}

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


def parse_iso(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S")


def load_focus():
    """Fokus-Zustand laden, fehlende Felder mit Defaults auffuellen."""
    try:
        with open(FOCUS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = {}
    merged = dict(FOCUS_DEFAULTS)
    merged.update(data)
    return merged


def save_focus(state):
    tmp = FOCUS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    os.replace(tmp, FOCUS_FILE)


SW_MINIMIZE = 6


def minimize_foreground():
    hwnd = user32.GetForegroundWindow()
    if hwnd:
        user32.ShowWindow(hwnd, SW_MINIMIZE)


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

    def today_total_seconds(self):
        """Gesamte heute getrackte Zeit (fuer den Tagesziel-Fortschritt)."""
        with self.lock:
            total = 0.0
            for s in self.sessions:
                total += (parse_iso(s["end"]) - parse_iso(s["start"])).total_seconds()
            if self.current:
                total += (parse_iso(self.current["end"]) - parse_iso(self.current["start"])).total_seconds()
            return total


def check_focus(tracker):
    """Wird nach jedem Poll aufgerufen: prueft Fokus-/Pausen-Ende und, waehrend
    einer aktiven Fokus-Phase, ob das aktuelle Fenster auf der Sperrliste
    steht. Greift nie in die eigentliche Zeiterfassung ein."""
    with FOCUS_LOCK:
        st = load_focus()
    if not st.get("active"):
        return
    now = datetime.now()

    end_at = st.get("end_at")
    if end_at and now >= parse_iso(end_at):
        if not st.get("prompted"):
            if st["mode"] == "focus":
                notify_queue.put({"type": "break_ready", "duration_min": st.get("duration_min", 25)})
            else:
                notify_queue.put({"type": "break_over", "duration_min": st.get("duration_min", 25)})
            st["prompted"] = True
            with FOCUS_LOCK:
                save_focus(st)
        return

    if st["mode"] != "focus" or not st.get("blocking"):
        return

    cur = tracker.current  # None, wenn gerade niemand aktiv ist (Leerlauf)
    if not cur:
        return
    hay = f"{cur['app']} {cur['title']}".lower()
    allow = {a.lower() for a in st.get("session_allow", [])}
    for kw in st.get("blocked", []):
        kwl = kw.lower().strip()
        if not kwl or kwl in allow or kwl not in hay:
            continue
        last = st.get("last_block") or {}
        if last.get("kw") == kwl and (now - parse_iso(last["at"])).total_seconds() < BLOCK_COOLDOWN:
            return
        minimize_foreground()
        if st.get("notifications", True):
            notify_queue.put({"type": "distraction", "keyword": kwl})
        st["last_block"] = {"kw": kwl, "at": iso(now)}
        with FOCUS_LOCK:
            save_focus(st)
        return


def check_daily_goal(tracker):
    """Meldet einmalig pro Tag, wenn 50 % bzw. 100 % des Tagesziels erreicht sind."""
    with FOCUS_LOCK:
        st = load_focus()
    today = datetime.now().date().isoformat()
    dirty = False
    if st.get("goal_notified_date") != today:
        st["goal_notified_date"] = today
        st["goal_notified_pct"] = []
        dirty = True
    goal_seconds = max(1, st.get("daily_goal_hours", 6) * 3600)
    pct = tracker.today_total_seconds() / goal_seconds * 100
    notified = set(st.get("goal_notified_pct", []))
    for mark in (50, 100):
        if pct >= mark and mark not in notified:
            notify_queue.put({"type": "goal", "pct": mark})
            notified.add(mark)
            dirty = True
    if dirty:
        st["goal_notified_pct"] = sorted(notified)
        with FOCUS_LOCK:
            save_focus(st)


def tracking_loop(tracker):
    last_flush = 0.0
    while True:
        try:
            tracker.poll()
            check_focus(tracker)
            check_daily_goal(tracker)
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


def start_notification_ui():
    """Laeuft in einem eigenen Thread und zeigt kleine Desktop-Kaertchen
    (Ablenkung erkannt / Pausen-Erinnerung / Tagesziel) unten rechts an,
    per tkinter - liegt der Python-Standardbibliothek bei, keine zusaetzliche
    Installation noetig. Faellt tkinter aus irgendeinem Grund weg, laeuft der
    Tracker trotzdem normal weiter (nur ohne Popups)."""
    try:
        import tkinter as tk
    except Exception as exc:
        print("Hinweis: tkinter nicht verfuegbar, Fokus-Benachrichtigungen sind deaktiviert:", exc, file=sys.stderr)
        return

    BG, BORDER, TEXT, MUTED, ACCENT = "#14161f", "#262a3a", "#f1f2f8", "#8b93a7", "#7c5cff"

    root = tk.Tk()
    root.withdraw()

    def make_toast(eyebrow, title, message, buttons):
        win = tk.Toplevel(root)
        win.overrideredirect(True)
        win.attributes("-topmost", True)
        win.configure(bg=BG, highlightbackground=BORDER, highlightthickness=1)

        head = tk.Frame(win, bg=BG)
        head.pack(fill="x", padx=16, pady=(14, 2))
        tk.Label(head, text=eyebrow, bg=BG, fg=ACCENT, font=("Segoe UI", 8, "bold")).pack(side="left")
        tk.Button(head, text="✕", bg=BG, fg=MUTED, bd=0, activebackground=BG,
                  cursor="hand2", command=win.destroy, font=("Segoe UI", 9)).pack(side="right")

        tk.Label(win, text=title, bg=BG, fg=TEXT, font=("Segoe UI", 12, "bold"),
                 wraplength=280, justify="left").pack(anchor="w", padx=16, pady=(4, 2))
        if message:
            tk.Label(win, text=message, bg=BG, fg=MUTED, font=("Segoe UI", 9),
                     wraplength=280, justify="left").pack(anchor="w", padx=16, pady=(0, 8))

        for label, cb, primary in buttons:
            tk.Button(
                win, text=label, bd=0, pady=7, cursor="hand2",
                bg=ACCENT if primary else "#1a1d29", fg="#ffffff" if primary else TEXT,
                activebackground="#6c4ce8" if primary else "#232738",
                font=("Segoe UI", 9, "bold" if primary else "normal"),
                command=lambda cb=cb, w=win: (cb(), w.destroy()),
            ).pack(fill="x", padx=16, pady=(0, 8))

        win.update_idletasks()
        w = max(300, win.winfo_reqwidth())
        h = win.winfo_reqheight()
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        win.geometry(f"{w}x{h}+{sw - w - 24}+{sh - h - 60}")
        win.after(25000, lambda: win.winfo_exists() and win.destroy())

    def _update(**changes):
        with FOCUS_LOCK:
            st = load_focus()
            st.update(changes)
            save_focus(st)

    def handle_distraction(job):
        kw = job.get("keyword", "")
        def allow():
            with FOCUS_LOCK:
                st = load_focus()
                if kw not in st["session_allow"]:
                    st["session_allow"].append(kw)
                save_focus(st)
        make_toast(
            "ZEITBLICK · FOKUS-MODUS", "Abgelenkt?",
            f"Erkannt: „{kw}“ – das steht auf deiner Sperrliste fuer diese Fokus-Sitzung.",
            [
                ("Danke für die Erinnerung", lambda: None, True),
                ("Das ist keine Ablenkung", allow, False),
                ("Fokus-Sitzung jetzt beenden", lambda: _update(active=False, end_at=None), False),
                ("Blocker für diese Sitzung deaktivieren", lambda: _update(blocking=False), False),
            ],
        )

    def handle_break_ready(job):
        dur = job.get("duration_min", 25)
        def start_break():
            _update(mode="break", end_at=iso(datetime.now() + timedelta(minutes=load_focus().get("break_min", 5))), prompted=False)
        def snooze():
            _update(end_at=iso(datetime.now() + timedelta(minutes=5)), prompted=False)
        make_toast(
            "ZEITBLICK · FOKUS-MODUS", "Bereit für eine Pause?",
            f"Dein {dur}-Minuten-Fokus-Block ist vorbei.",
            [
                ("Pause starten (5 Min.)", start_break, True),
                ("Snoozen (5 Min.)", snooze, False),
            ],
        )

    def handle_break_over(job):
        dur = job.get("duration_min", 25)
        def next_focus():
            _update(mode="focus", end_at=iso(datetime.now() + timedelta(minutes=dur)), prompted=False, session_allow=[])
        make_toast(
            "ZEITBLICK · FOKUS-MODUS", "Pause vorbei",
            "Bereit für den nächsten Fokus-Block?",
            [
                (f"Fokus starten ({dur} Min.)", next_focus, True),
                ("Fokus-Modus beenden", lambda: _update(active=False, end_at=None), False),
            ],
        )

    def handle_goal(job):
        pct = job.get("pct", 0)
        text = "Tagesziel erreicht! Starker Tag." if pct >= 100 else "Du bist auf halbem Weg zu deinem Tagesziel."
        make_toast("ZEITBLICK · TAGESZIEL", f"{pct} % erreicht", text, [("Ok", lambda: None, True)])

    def handle_update(job):
        version = job.get("version", "")
        url = job.get("url") or "https://github.com/smaloxzs/zeitblick"
        def open_download():
            import webbrowser
            webbrowser.open(url)
        make_toast(
            "ZEITBLICK · UPDATE", f"Version {version} ist verfügbar",
            "Du nutzt gerade eine ältere Version von Zeitblick.",
            [("Update herunterladen", open_download, True), ("Später erinnern", lambda: None, False)],
        )

    handlers = {
        "distraction": handle_distraction,
        "break_ready": handle_break_ready,
        "break_over": handle_break_over,
        "goal": handle_goal,
        "update": handle_update,
    }

    def poll_queue():
        try:
            while True:
                job = notify_queue.get_nowait()
                fn = handlers.get(job.get("type"))
                if fn:
                    try:
                        fn(job)
                    except Exception as exc:
                        print("Benachrichtigungs-Fehler:", exc, file=sys.stderr)
        except queue.Empty:
            pass
        root.after(400, poll_queue)

    root.after(400, poll_queue)
    root.mainloop()


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


def _version_tuple(v):
    return tuple(int(p) if p.isdigit() else 0 for p in str(v).split("."))


def check_for_update():
    """Einmaliger, stiller Update-Check beim Start. Meldet nur per Kaertchen,
    wenn eine neuere Version vorliegt - ersetzt nichts automatisch und
    blockiert nichts, falls kein Internet da ist."""
    try:
        import urllib.request
        with urllib.request.urlopen(VERSION_URL, timeout=4) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        remote = info.get("version", "")
        if remote and _version_tuple(remote) > _version_tuple(VERSION):
            notify_queue.put({"type": "update", "version": remote,
                               "url": info.get("download_url", "")})
    except Exception:
        pass  # kein Internet / Datei nicht erreichbar -> einfach weiterlaufen


def open_app_window(url):
    """Oeffnet das Dashboard als eigenes App-Fenster (ohne Adressleiste/Tabs)
    per Edge/Chrome --app-Modus - genau das Verfahren, das Zeitblick.cmd fuer
    die Skript-Variante schon nutzt. Sieht dadurch wie eine echte installierte
    App aus statt wie ein gewoehnlicher Browser-Tab. Faellt auf einen normalen
    Browser-Tab zurueck, falls weder Edge noch Chrome gefunden werden."""
    candidates = [
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Google", "Chrome", "Application", "chrome.exe"),
    ]
    for browser in candidates:
        if browser and os.path.isfile(browser):
            try:
                subprocess.Popen([browser, f"--app={url}", "--window-size=1280,860"])
                return
            except OSError:
                continue
    try:
        webbrowser.open(url)
    except Exception:
        pass


def _run_hidden_powershell(cmd):
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", cmd],
        creationflags=subprocess.CREATE_NO_WINDOW, check=False,
    )


def _create_shortcut(link_path, target, workdir, icon=None, args=None):
    icon_line = f"$s.IconLocation='{icon}'; " if icon else ""
    args_line = f"$s.Arguments='{args}'; " if args else ""
    cmd = (
        f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{link_path}'); "
        f"$s.TargetPath='{target}'; $s.WorkingDirectory='{workdir}'; {icon_line}{args_line}"
        f"$s.WindowStyle=7; $s.Save()"
    )
    _run_hidden_powershell(cmd)


def install_self():
    """Nur relevant fuer die gebaute .exe: kopiert sich selbst nach
    %LOCALAPPDATA%\\Zeitblick, legt Desktop-/Startmenue-Verknuepfung an,
    traegt Autostart (Registry Run-Key) sowie einen Eintrag unter
    "Apps & Features" ein, und startet sich von dort neu. Laeuft nur beim
    allerersten Start (z. B. direkt aus dem Downloads-Ordner)."""
    import shutil
    import winreg

    os.makedirs(APP_DIR, exist_ok=True)

    # Falls schon eine (aeltere) Version im Hintergrund laeuft - z. B. per
    # Autostart aus einer frueheren Installation -, sperrt Windows deren
    # .exe-Datei zum Ueberschreiben. Deshalb hier zuerst eine evtl. laufende
    # Instanz beenden, sonst wuerde copy2() stillschweigend fehlschlagen und
    # man wuerde beim Neustart einfach wieder die alte, laufende Version zu
    # sehen bekommen statt des gerade heruntergeladenen Updates.
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                old_pid = f.read().strip()
            subprocess.run(["taskkill", "/PID", old_pid, "/F"], creationflags=subprocess.CREATE_NO_WINDOW, check=False)
            time.sleep(1)
        except (OSError, ValueError):
            pass

    try:
        if os.path.abspath(sys.executable) != os.path.abspath(INSTALLED_EXE):
            shutil.copy2(sys.executable, INSTALLED_EXE)
    except OSError as exc:
        print("Installation fehlgeschlagen:", exc, file=sys.stderr)
        return False

    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    start_menu = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs")
    # --open (nicht im Autostart-Registry-Eintrag!) unterscheidet einen
    # bewussten Icon-Klick vom stillen Autostart bei jedem Hochfahren -
    # nur bei --open soll sich sichtbar das Dashboard oeffnen.
    _create_shortcut(os.path.join(desktop, "Zeitblick.lnk"), INSTALLED_EXE, APP_DIR, args="--open")
    _create_shortcut(os.path.join(start_menu, "Zeitblick.lnk"), INSTALLED_EXE, APP_DIR, args="--open")

    try:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.SetValueEx(k, APP_NAME, 0, winreg.REG_SZ, f'"{INSTALLED_EXE}"')
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as k:
            winreg.SetValueEx(k, "DisplayName", 0, winreg.REG_SZ, "Zeitblick")
            winreg.SetValueEx(k, "DisplayVersion", 0, winreg.REG_SZ, VERSION)
            winreg.SetValueEx(k, "Publisher", 0, winreg.REG_SZ, "Marlon Pilz")
            winreg.SetValueEx(k, "UninstallString", 0, winreg.REG_SZ, f'"{INSTALLED_EXE}" --uninstall')
            winreg.SetValueEx(k, "InstallLocation", 0, winreg.REG_SZ, APP_DIR)
            winreg.SetValueEx(k, "NoModify", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(k, "NoRepair", 0, winreg.REG_DWORD, 1)
    except OSError as exc:
        print("Registry-Eintrag fehlgeschlagen:", exc, file=sys.stderr)

    # --open: signalisiert der neu gestarteten Kopie, nach dem erfolgreichen
    # Start automatisch das Dashboard zu oeffnen - ohne das saehe ein Nutzer
    # nach dem Doppelklick (noconsole!) ueberhaupt keine Rueckmeldung und
    # wuerde die App faelschlich fuer kaputt halten. Derselbe Schalter wie
    # bei den Desktop-/Startmenue-Verknuepfungen (siehe oben).
    subprocess.Popen([INSTALLED_EXE, "--open"])
    return True


def uninstall_self():
    """Gegenstueck zu install_self(): beendet einen laufenden Tracker,
    entfernt Verknuepfungen, Autostart- und Uninstall-Registry-Eintrag, und
    loescht zuletzt die eigene .exe samt Ordner (ueber ein kurz verzoegertes,
    von diesem Prozess losgeloestes Kommando, da eine laufende .exe sich
    unter Windows nicht selbst loeschen kann)."""
    import winreg

    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                pid = f.read().strip()
            subprocess.run(["taskkill", "/PID", pid, "/F"], creationflags=subprocess.CREATE_NO_WINDOW, check=False)
        except (OSError, ValueError):
            pass

    desktop = os.path.join(os.path.expanduser("~"), "Desktop", "Zeitblick.lnk")
    start_menu = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Zeitblick.lnk")
    for path in (desktop, start_menu):
        try:
            os.remove(path)
        except OSError:
            pass

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            winreg.DeleteValue(k, APP_NAME)
    except OSError:
        pass
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY)
    except OSError:
        pass

    # Sich selbst + Ordner loeschen, nachdem dieser Prozess beendet ist.
    # "timeout" braucht eine echte Konsole und schlaegt in einem
    # losgeloesten Hintergrundprozess fehl - "ping" als Wartetrick
    # funktioniert dagegen ueberall zuverlaessig.
    subprocess.Popen(
        f'cmd /c ping -n 3 127.0.0.1 >nul & rmdir /s /q "{APP_DIR}"',
        shell=True, creationflags=subprocess.CREATE_NO_WINDOW,
    )


class Handler(SimpleHTTPRequestHandler):
    # Die mitgelieferte Schrift (fonts/*.woff2) kennt mimetypes nicht, sie
    # ginge sonst als application/octet-stream raus.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".woff2": "font/woff2"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # keine Request-Logs in der Konsole

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except ValueError:
            return {}

    def do_GET(self):
        path = self.path.split("?")[0]

        # Die Tag-Dateien (data/JJJJ-MM-TT.json) liegen unter DATA_DIR, nicht
        # unter BASE_DIR/ASSETS_DIR (dem Ordner der mitgelieferten index.html/
        # app.js). Bei der Skript-Variante ist das zufaellig derselbe Ordner,
        # weshalb es dort nie auffiel - bei der gebauten .exe liegen beide
        # Ordner an komplett unterschiedlichen Orten (ASSETS_DIR ist der
        # temporaere PyInstaller-Extraktionsordner). Ohne diese Sonderbehandlung
        # antwortet die generische Static-File-Auslieferung hier immer mit 404,
        # das Dashboard zeigt dauerhaft "Tracker aus" und einen leeren Kalender,
        # obwohl im Hintergrund laengst getrackt und gespeichert wird.
        if path.startswith("/data/") and path.endswith(".json"):
            # os.path.basename() verwirft jegliche "../"-Anteile von selbst,
            # damit bleibt der Zugriff auf DATA_DIR beschraenkt.
            file_path = os.path.join(DATA_DIR, os.path.basename(path))
            try:
                with open(file_path, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                self.send_response(404)
                self.end_headers()
            return

        if path == "/api/focus":
            with FOCUS_LOCK:
                st = load_focus()
            now = datetime.now()
            remaining = None
            if st.get("active") and st.get("end_at"):
                remaining = max(0, int((parse_iso(st["end_at"]) - now).total_seconds()))
            today_seconds = GLOBAL_TRACKER.today_total_seconds() if GLOBAL_TRACKER else 0
            goal_seconds = max(1, st.get("daily_goal_hours", 6) * 3600)
            payload = dict(st)
            payload["remaining_seconds"] = remaining
            payload["today_seconds"] = today_seconds
            payload["goal_seconds"] = goal_seconds
            payload["goal_pct"] = round(min(100, today_seconds / goal_seconds * 100))
            self._send_json(payload)
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/api/focus/start":
            body = self._read_json_body()
            with FOCUS_LOCK:
                st = load_focus()
                dur = int(body.get("duration_min", st.get("duration_min", 25)))
                st["duration_min"] = dur
                st["active"] = True
                st["mode"] = "focus"
                st["end_at"] = iso(datetime.now() + timedelta(minutes=dur))
                st["prompted"] = False
                st["session_allow"] = []
                st["last_block"] = None
                save_focus(st)
            self._send_json(st)
            return

        if path == "/api/focus/stop":
            with FOCUS_LOCK:
                st = load_focus()
                st["active"] = False
                st["end_at"] = None
                save_focus(st)
            self._send_json(st)
            return

        if path == "/api/focus/settings":
            body = self._read_json_body()
            with FOCUS_LOCK:
                st = load_focus()
                for key in ("notifications", "blocking", "daily_goal_hours", "duration_min", "break_min"):
                    if key in body:
                        st[key] = body[key]
                if "blocked" in body and isinstance(body["blocked"], list):
                    st["blocked"] = [str(x).strip() for x in body["blocked"] if str(x).strip()][:60]
                save_focus(st)
            self._send_json(st)
            return

        self.send_error(404)


def main():
    if os.name != "nt":
        sys.exit("Zeitblick laeuft nur unter Windows.")

    if "--uninstall" in sys.argv:
        uninstall_self()
        return

    skip_install = "--no-install" in sys.argv  # nur zum Testen/Debuggen der gebauten .exe
    if is_frozen() and not skip_install and os.path.abspath(sys.executable) != os.path.abspath(INSTALLED_EXE):
        # Erststart einer gerade heruntergeladenen .exe (z. B. aus "Downloads"):
        # an den festen Ort installieren und von dort neu starten. Kehrt bei
        # Erfolg nicht in diesen Prozess zurueck.
        if install_self():
            return

    os.makedirs(APP_DIR, exist_ok=True)

    # --open kommt von den Desktop-/Startmenue-Verknuepfungen (bewusster Klick)
    # und vom Erst-Install-Relaunch, aber NICHT vom stillen Autostart-Registry-
    # Eintrag - nur dann soll sich sichtbar das Dashboard oeffnen.
    show_dashboard = "--open" in sys.argv

    if not acquire_singleton():
        print("Zeitblick laeuft bereits - diese Instanz beendet sich.")
        print(f"Dashboard: http://localhost:{PORT}")
        if show_dashboard:
            open_app_window(f"http://localhost:{PORT}")
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

    if show_dashboard:
        # Einzige sichtbare Rueckmeldung nach der stillen Installation
        # (noconsole) - ohne das denkt man, der Doppelklick hat nichts getan.
        open_app_window(f"http://localhost:{PORT}")

    prune_old_data()
    tracker = Tracker()
    global GLOBAL_TRACKER
    GLOBAL_TRACKER = tracker
    atexit.register(tracker.flush)
    threading.Thread(target=tracking_loop, args=(tracker,), daemon=True).start()
    threading.Thread(target=start_notification_ui, daemon=True).start()
    threading.Thread(target=check_for_update, daemon=True).start()

    print(f"Zeitblick {VERSION} laeuft.")
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
