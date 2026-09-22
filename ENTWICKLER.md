# Zeitblick – Entwickler- & Weiterentwicklungs-Doku

Diese Datei fasst **alles Technische** über Zeitblick zusammen, damit man in einem
**neuen Chat** sofort weiterarbeiten kann. Kurzanleitung für die Nutzung steht in
`README.md`. Zum Weiterentwickeln in einem neuen Chat einfach sagen:
„Lies `web-demos/zeitblick/ENTWICKLER.md` und `README.md`, ich möchte an Zeitblick
weiterarbeiten.“

## Was Zeitblick ist
Lokaler Aktivitäts-Tracker (Rize-Nachbau) für Windows. Läuft komplett offline,
keine Cloud, keine Screenshots, kein Keylogging – liest nur Fenster-Metadaten
(Prozessname + Fenstertitel). Zwei Teile in einem Prozess:
1. **Tracker** (`tracker.py`) – zeichnet auf und liefert das Dashboard aus.
2. **Dashboard** (`index.html` / `style.css` / `app.js`) – die Auswertung im Browser.

## Dateien
| Datei | Zweck |
|---|---|
| `tracker.py` | Python (nur Stdlib, inkl. tkinter). Pollt via Win32 alle 5 s das Vordergrundfenster, erkennt Leerlauf, schreibt `data/JJJJ-MM-TT.json`, prüft den Fokus-Modus (`check_focus`/`check_daily_goal`), zeigt Desktop-Toasts (`start_notification_ui`), serviert Dashboard + `/api/focus/*`-API auf Port **8771**. Einzel-Instanz über Windows-Mutex. |
| `index.html` | Grundgerüst des Dashboards (Sidebar inkl. Fokus-Modus/Tagesziel, Kalender, Statistik-Container). |
| `style.css` | Dunkles Rize-Design. |
| `app.js` | Gesamte Dashboard-Logik: Laden, Kategorisieren, Kalender, Statistik, alle Umschalter, Fokus-Modus-UI (spricht die `/api/focus`-Endpunkte an). |
| `categories.json` | Automatisch gelernte App→Kategorie-Zuordnungen (von der geplanten Aufgabe gepflegt). |
| `data/JJJJ-MM-TT.json` | Eine Datei pro Tag: `{app, title, start, end}` je Session. |
| `focus_state.json` | Laufzeit-Zustand des Fokus-Modus (siehe unten). Nicht in Git (`.gitignore`), ändert sich zu häufig. |
| `start-tracker.cmd` / `stop-tracker.cmd` | Tracker sichtbar starten / beenden. |
| `install-autostart.cmd` / `uninstall-autostart.cmd` | Autostart (Verknüpfung in `shell:startup`, startet `pythonw tracker.py`) ein-/ausschalten. |
| `Zeitblick.cmd` | Dashboard als App-Fenster (Edge/Chrome `--app`) öffnen, startet Tracker mit. |
| `create-desktop-icon.cmd` / `zeitblick.ico` | Desktop-Verknüpfung mit Uhr-Icon anlegen. |

Registriert in `../../.claude/launch.json` als Eintrag `zeitblick` (Port 8771,
startet `python web-demos/zeitblick/tracker.py` – Ausnahme vom „http.server“-Muster
der anderen web-demos).

## tracker.py – wichtige Einstellungen (oben im Datei-Kopf)
- `PORT = 8771`
- `POLL_INTERVAL = 5` – Sekunden zwischen zwei Messungen
- `IDLE_LIMIT = 180` – ab 3 Min. ohne Maus/Tastatur gilt man als abwesend (Pause)
- `FLUSH_INTERVAL = 20` – wie oft auf Platte geschrieben wird
- `MIN_SESSION_SECONDS = 2` – kürzere Sessions werden verworfen
- `KEEP_DAYS = 0` – `0` = Daten für immer behalten; z. B. `365` = nur letztes Jahr
- Einzel-Instanz: Windows-Mutex `ZeitblickTrackerSingleton` (NICHT über Port prüfen –
  Windows erlaubt via SO_REUSEADDR sonst zwei Prozesse auf demselben Port).

## app.js – Aufbau & Stellschrauben
**Konstanten oben:** `ZOOM_MIN/MAX/STEP/DEFAULT`, `BURST_GAP=300` (Pause bis eine
neue „Nutzung“ zählt), `MERGE_GAP=90` (gleiche Tätigkeit verschmelzen),
`ABSORB_MAX=60` („Zusammengefasst“ schluckt Wechsel < 1 Min.), `DETAIL_MIN=5`
(„Genau“ zeigt ab 5 Sek.), `REFRESH_MS=30000`.

**Zustand (`state`, in localStorage gespeichert):** `view` (kalender/statistik),
`statsPeriod` (tag/woche/monat), `detail` (grob/genau), `colorMode`
(kategorie/app), `hourH` (Zoom), `overrides` (manuelle App-Kategorien),
`learned` (aus categories.json), `hiddenCats`.

### 10 Kategorien
Definiert in `CATEGORIES` (Key → {name, color}): `produktiv, design, lernen,
kommunikation, soziale_medien, browsing, gaming, unterhaltung, windows, system`.

### Häufige Anpassungen
- **Neue Kategorie:** Eintrag in `CATEGORIES` ergänzen (Key + Name + Farbe). Farbe
  klar von den anderen abheben. Danach ggf. Apps/Sites zuordnen. Auch im Prompt der
  geplanten Aufgabe die Kategorienliste ergänzen (siehe unten).
- **Programm einer Kategorie zuordnen:** `DEFAULT_APP_CATEGORIES` – `"spiel.exe":
  "gaming"`. (Oder im Dashboard per Dropdown → landet in `overrides`/localStorage.)
- **Website erkennen:** `SITE_RULES` (Regex → Anzeigename, Reihenfolge = Priorität)
  für den Namen, `TITLE_RULES` (Regex → Kategorie) für die Kategorie. Beides greift
  am Browser-Fenstertitel.
- **Website manuell umsortieren:** Im Tages-Panel (rechts, `renderStats`) hat auch
  jede Website ein Kategorie-Dropdown. Die Wahl wird in `state.overrides` unter dem
  Website-Key `"web::<site>"` gespeichert und hat in `categorize()` Vorrang vor den
  `TITLE_RULES`. (Programm-Overrides stehen unter dem exe-Namen.)
- **Schöner Anzeigename:** `APP_NAMES` – `"r5apex_dx12.exe": "Apex Legends"`.
- **Programm-Farben (Modus „nach Programm“):** Palette `APP_PALETTE`; Zuordnung in
  `rebuildAppColors()` nach Nutzungsdauer.
- **Absorptions-Schwelle ändern:** `ABSORB_MAX` (Sekunden).

### Wichtige Funktionen
- `categorize(app, title)` – Kategorie einer Session (TITLE_RULES > overrides >
  learned > DEFAULT).
- `browserSite(title)` / `activityKey` / `activityLabel` / `isWeb` – Browser-Sessions
  nach Website aufteilen (YouTube, TikTok … als eigene Einträge).
- `aggregate(sessions)` – zählt Kategorien + Aktivitäten (Browser nach Website).
- `mergedForDisplay(sessions)` – baut die Kalender-Blöcke (Detailgrad: absorbieren/
  verschmelzen).
- `renderCalendar()` – Wochenkalender, **Zeitachse invertiert** (früh unten, spät
  oben) via CSS `bottom`.
- `renderStatsView()` – Statistik für Tag/Woche/Monat; `barChart()` (generisch),
  `hourlyBuckets()` (Tagesansicht stündlich), `donutSVG()`. Enthält auch die
  **Browser-Karte** („Im Browser“): filtert `allSessions` auf `BROWSERS`, aggregiert
  separat → Donut nach Kategorie + Top-Websites (zeigt, wie sich die Browser-Zeit
  auf Kategorien verteilt).
- `periodDays()` / `periodLabel()` / `navigate(dir)` – Zeitraum-Logik.

Alle Diagramme sind handgerolltes Inline-SVG, keine Bibliotheken.

## Fokus-Modus (Rize-Feature-Nachbau: Pomodoro + Ablenkungssperre)

**tracker.py-Seite** (Server + Erzwingung):
- `FOCUS_DEFAULTS` / `load_focus()` / `save_focus()` – Zustand in `focus_state.json`
  (Felder: `active`, `mode` "focus"/"break", `end_at` (ISO), `duration_min`,
  `break_min`, `notifications`, `blocking`, `blocked` (Liste von Stichworten,
  klein geschrieben, gegen `"<exe> <titel>"` per Substring geprüft – deckt
  sowohl Programme `"steam.exe"` als auch Website-Schlüsselwörter `"youtube"` ab),
  `session_allow` (Ausnahmen für die laufende Sitzung), `daily_goal_hours`).
- `check_focus(tracker)` – wird in `tracking_loop` nach jedem `tracker.poll()`
  aufgerufen. Prüft erst, ob `end_at` erreicht ist (→ Benachrichtigung in
  `notify_queue`, `prompted`-Flag verhindert Spam), sonst bei aktivem
  Fokus-Modus + `blocking=True`, ob `tracker.current` (das gerade aktive
  Fenster) ein Stichwort trifft → `minimize_foreground()` (ctypes
  `ShowWindow(hwnd, SW_MINIMIZE)`) + Benachrichtigung. `BLOCK_COOLDOWN=45s`
  verhindert wiederholtes Minimieren derselben Ablenkung.
- `check_daily_goal(tracker)` – meldet einmalig pro Tag bei 50 %/100 % des
  `daily_goal_hours`-Ziels (verglichen mit `Tracker.today_total_seconds()` –
  bewusst **gesamte** getrackte Zeit, nicht nur eine Kategorie, weil
  Kategorisierung nur im Frontend existiert, nicht in Python).
- `start_notification_ui()` – eigener Daemon-Thread, eigener `tkinter.Tk()`
  mit `root.mainloop()`. Andere Threads legen Jobs in `notify_queue` (ein
  normales `queue.Queue`, thread-safe); der Tk-Thread pollt sie per
  `root.after(400, poll_queue)` und baut dann `Toplevel`-Kärtchen
  (`overrideredirect`, unten rechts positioniert, dunkles Branding). **Wichtig:**
  Tkinter-Objekte NIE aus einem anderen Thread anfassen – nur über die Queue
  kommunizieren. Fällt der `tkinter`-Import weg, läuft der Tracker trotzdem
  normal weiter (nur ohne Popups), siehe try/except in `start_notification_ui`.
- `Handler.do_GET`/`do_POST` – `/api/focus` (GET, liefert Zustand +
  `remaining_seconds`/`today_seconds`/`goal_seconds`/`goal_pct`),
  `/api/focus/start` (POST `{duration_min}`), `/api/focus/stop` (POST),
  `/api/focus/settings` (POST, beliebige Teilmenge von `notifications`,
  `blocking`, `blocked`, `daily_goal_hours`, `duration_min`, `break_min`).
  Alles andere faellt an `SimpleHTTPRequestHandler` durch (normales Datei-Serving
  bleibt unangetastet).

**Seitenleisten-Umschalter „Ansicht“ / „Fokus-Modus“**: Die Sidebar zeigt immer
nur EINEN der beiden Bereiche (`#sidebarAnsicht`: Farbe der Blöcke/Kategorien/
Detailgrad; `#sidebarFokus`: Fokus-Modus/Tagesziel), umgeschaltet per
Pill-Buttons `#tabAnsicht`/`#tabFokus` (`applySidebarTab()`/`setSidebarTab()`,
localStorage `zeitblick.sidebarTab`, Standard "ansicht") — verhindert, dass die
Sidebar so lang wird, dass man scrollen muss. Die Stichwort-Chips
(`#focusBlockedChips`) haben zusätzlich `max-height:96px` + eigenen Scroll
(Klasse `.chip-row-scroll`), damit eine lange Sperrliste nicht den ganzen
Tab in die Höhe zieht.

**app.js-Seite** (UI, Abschnitt „Fokus-Modus & Tagesziel“ ganz am Dateiende):
- `refreshFocus()` pollt `/api/focus` alle 3 s, `renderFocus()` zeichnet Chips,
  Countdown, Toggles, blockierte-Stichworte-Liste und die Tagesziel-Leiste.
- Duration-Chips setzen nur `selectedFocusDuration` (lokal); erst „Fokus starten“
  postet an `/api/focus/start`.
- Stichworte hinzufügen/entfernen und Toggle-Änderungen gehen sofort per
  `apiFocusPost("/api/focus/settings", …)` raus.

**Testen ohne das echte Fenster zu minimieren:** `check_focus`/`check_daily_goal`
sind reine Funktionen, die einen Tracker-artigen Wert (`.current`,
`.today_total_seconds()`) entgegennehmen – lassen sich mit einem Fake-Objekt und
gemocktem `tracker.minimize_foreground` isoliert testen (siehe Test vom
2026-09-22 im Scratchpad, 16/16 Faelle bestanden). Beim Testen über die echte
laufende Instanz IMMER erst `blocked: []` setzen, bevor per Klick/API eine
Sitzung mit `blocking=true` gestartet wird, sonst kann das gerade echte
Vordergrundfenster des Nutzers minimiert werden.

## Geplante Aufgabe (Auto-Kategorisierung)
Task-ID `zeitblick-neue-apps-kategorisieren`, täglich 20:00. Liest die Daten der
letzten 7 Tage, recherchiert unbekannte Programme per Websuche, trägt sie in
`categories.json` ein. **Verbraucht Claude-Credits** (nur diese Aufgabe; Tracker
selbst = 0). Bei neuer Kategorie den Prompt der Aufgabe um den neuen Kategorie-Key
erweitern. Kann in der Claude-App unter „Scheduled“ verwaltet/abgeschaltet werden.

## Datenschutz-Grundsätze (beibehalten!)
Nur Fenster-Metadaten, alles lokal. Fenstertitel sind privat – bei Websuchen nie
Titel-Inhalte suchen, nur Programmnamen. Keine Screenshots, kein Keylogging.

## Ideen für spätere Verfeinerungen
- Ziele/Limits pro Kategorie (z. B. „max. 1 h Gaming/Tag“) mit Warnung.
- Wochen-/Monatsvergleich (diese vs. letzte Periode).
- Export als CSV/PDF-Report.
- Kleines Tray-Icon (Statusanzeige ohne Dashboard).
- Als eigenständige .exe bündeln (PyInstaller), damit kein Python nötig ist.
- Optionale Browser-Erweiterung für die volle URL statt nur Tab-Titel.

## Auf einen anderen PC übertragen
Windows→Windows: kompletten Ordner `zeitblick` kopieren, Python 3.8+ installieren,
einmal `install-autostart.cmd` ausführen. Für eine echte App ohne Python:
`pip install pyinstaller` und `pyinstaller --onefile --noconsole tracker.py` →
`dist/tracker.exe` neben die Web-Dateien legen. Mac/Linux: der Tracker nutzt
Windows-APIs (ctypes user32/kernel32) und müsste dafür portiert werden.
