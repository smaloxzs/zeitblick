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
| `tracker.py` | Python (nur Stdlib). Pollt via Win32 alle 5 s das Vordergrundfenster, erkennt Leerlauf, schreibt `data/JJJJ-MM-TT.json`, serviert Dashboard auf Port **8771**. Einzel-Instanz über Windows-Mutex. |
| `index.html` | Grundgerüst des Dashboards (Sidebar, Kalender, Statistik-Container). |
| `style.css` | Dunkles Rize-Design. |
| `app.js` | Gesamte Dashboard-Logik: Laden, Kategorisieren, Kalender, Statistik, alle Umschalter. |
| `categories.json` | Automatisch gelernte App→Kategorie-Zuordnungen (von der geplanten Aufgabe gepflegt). |
| `data/JJJJ-MM-TT.json` | Eine Datei pro Tag: `{app, title, start, end}` je Session. |
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
