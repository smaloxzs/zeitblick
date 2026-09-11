# Zeitblick – lokaler Aktivitäts-Tracker (Rize-Nachbau)

Zeitblick trackt automatisch, welche Programme du an deinem Windows-PC benutzt,
und zeigt sie – wie bei [Rize](https://rize.io) – in einem Wochenkalender im
Google-Kalender-Stil an, farblich sortiert nach Kategorien (Produktivität,
Design & Kreativ, Lernen, Kommunikation, Soziale Medien, Browsing, Gaming,
Unterhaltung, Windows, Sonstiges).

Alles läuft **100 % lokal** auf deinem PC: keine Cloud, kein Account, keine
Screenshots, kein Keylogging. Wie bei Rize werden nur Fenster-Metadaten
gelesen – Programmname und Fenstertitel.

## Starten & Autostart

Die Skripte im Ordner (Doppelklick):

| Skript | Zweck |
|---|---|
| **`install-autostart.cmd`** | **Einmalig ausführen.** Richtet den Autostart ein (Tracker startet ab jetzt bei jedem Hochfahren unsichtbar) und startet ihn sofort. |
| **`Zeitblick.cmd`** | Öffnet das Dashboard als **eigenes App-Fenster** (ohne Adressleiste/Tabs, wie eine native App). Startet den Tracker mit, falls er nicht läuft. |
| **`create-desktop-icon.cmd`** | Legt ein **Zeitblick-Icon auf den Desktop** (Uhr-Symbol). Doppelklick darauf öffnet den Tracker. |
| `start-tracker.cmd` | Tracker sichtbar (mit Konsolenfenster) starten + Dashboard im normalen Browser öffnen. |
| `stop-tracker.cmd` | Tracker beenden. |
| `uninstall-autostart.cmd` | Autostart wieder entfernen (Daten bleiben erhalten). |

**Empfohlener Ablauf:** Einmal `install-autostart.cmd` doppelklicken – fertig.
Danach läuft der Tracker für immer im Hintergrund, auch nach jedem Neustart.
Zum Anschauen: das **Zeitblick-Icon auf dem Desktop** doppelklicken (falls es
fehlt, einmal `create-desktop-icon.cmd` ausführen). Oben links im Dashboard
zeigt ein grüner Punkt „Tracker läuft – Daten sind live“, ob gerade getrackt wird.

### Wie der Autostart funktioniert

`install-autostart.cmd` legt eine Verknüpfung in den Windows-Autostart-Ordner
(`shell:startup`). Sie startet `pythonw.exe tracker.py` – `pythonw` ist die
**fensterlose** Python-Variante, es erscheint also kein Konsolenfenster. Bei
jeder Anmeldung startet Windows den Tracker dadurch automatisch und unsichtbar.
Eine **Einzel-Instanz-Sperre** (Windows-Mutex) sorgt dafür, dass immer nur ein
Tracker gleichzeitig läuft – egal wie oft gestartet wird.

### Ressourcenverbrauch

Extrem gering: ~16 MB Arbeitsspeicher, praktisch 0 % CPU (alle 5 Sekunden eine
Millisekunden-Abfrage ans System), ~6 KB Daten pro Tag. Läuft problemlos
dauerhaft im Hintergrund mit.

### Wie lange bleiben die Daten?

Standardmäßig **für immer** – bei ~6 KB pro Tag sind das nur ~2 MB pro Jahr.
Willst du automatisch aufräumen, setze in `tracker.py` oben `KEEP_DAYS` z. B.
auf `365` (behält nur das letzte Jahr). `0` = nie löschen.
Die Daten sind einfache JSON-Dateien in `data/` – jederzeit kopierbar,
sicherbar oder löschbar.

## Was das Dashboard kann

Oben lässt sich zwischen zwei Ansichten umschalten (**Kalender / Statistik**):

**Kalender-Ansicht**
- **Wochenkalender** (Mo–So) mit farbigen Aktivitätsblöcken, die den App- bzw.
  Website-Namen direkt anzeigen (z. B. „Apex Legends“, „🌐 YouTube“), rote
  „Jetzt“-Linie, Klick auf einen Tag zeigt dessen Statistik. Die **Zeitachse
  läuft von unten nach oben** (frühe Uhrzeiten unten, späte oben).
- **Tages-Statistik** (rechte Leiste): Donut-Diagramm nach Kategorien,
  Gesamtzeit, Top-Programme mit Dauer und „N× benutzt“

**Statistik-Ansicht (Tag / Woche / Monat – oben umschaltbar)**
- **Zeitraum-Umschalter**: Tag, Woche oder Monat. Mit ‹ › blätterst du je nach
  Zeitraum tage-, wochen- oder monatsweise; „Heute“ springt zurück.
- **Balkendiagramm**: beim **Tag** stündlich (Aktivität pro Stunde), bei **Woche**
  und **Monat** pro Tag (gestapelt nach Kategorien). Balken anklicken öffnet den
  jeweiligen Tag im Detail.
- **Donut** mit Gesamtzeit und Kategorien-Verteilung des Zeitraums; dazu
  Durchschnitt pro aktivem Tag (Woche/Monat).
- **Top-Programme & Websites** des Zeitraums als Balken, umschaltbar nach Dauer
  oder Häufigkeit.
- **Kategorien im Detail**: pro Kategorie aufgeschlüsselt, welche einzelnen
  Programme und Websites dahinterstecken.
- **Kategorien anpassen**: Dropdown neben jedem Programm **und jeder Website**
  (rechte Tages-Leiste) – so kannst du z. B. YouTube auf „Unterhaltung“ oder eine
  bestimmte Seite auf „Produktivität“ setzen. Deine Wahl überschreibt die
  automatische Zuordnung und gilt nur für diese eine Website; gespeichert im
  Browser (localStorage).
- **Automatische Kategorisierung neuer Apps**: Eine geplante Claude-Aufgabe
  („Zeitblick: neue Apps automatisch kategorisieren“, täglich 20:00 Uhr,
  sichtbar unter „Scheduled“ in der Claude-App) prüft die Tracking-Daten der
  letzten 7 Tage, recherchiert unbekannte Programme im Internet und trägt sie
  in `categories.json` ein. Bis dahin zeigen unbekannte Apps ein **NEU**-Badge
  und laufen unter „Sonstiges“. Rangfolge: eigene Dropdown-Wahl >
  `categories.json` > eingebaute Liste.
- **Website-Erkennung im Browser (ohne Erweiterung)**: Der Tracker liest den
  Fenstertitel, der bei Chrome/Edge/Firefox den aktiven Tab enthält
  (z. B. „… - YouTube - Google Chrome“). Daraus werden einzelne Websites als
  eigene Einträge erkannt (YouTube, TikTok, Instagram, Reddit, GitHub, Wikipedia,
  Udemy … – mit 🌐-Symbol) und passend kategorisiert (YouTube → Unterhaltung,
  Udemy → Lernen, Instagram/TikTok → Soziale Medien, GitHub → Produktivität …).
  Für die *vollständige URL* jeder Unterseite bräuchte man eine Browser-Erweiterung;
  für den Überblick, welche Seiten du wie lange nutzt, reicht der Tab-Titel.
- **Leerlauf-Erkennung**: nach 3 Minuten ohne Maus/Tastatur wird pausiert
- **Farb-Modus** (links in der Seitenleiste umschaltbar): „nach Kategorie“
  (gleiche Farbe pro Kategorie, z. B. alle Spiele rot) oder „nach Programm“
  (jedes Spiel/Programm/jede Website eine eigene Farbe – Apex und Valorant dann
  unterschiedlich). Farben sind in Kalender und Statistik identisch.
- **Zoom**: Mit den +/−-Buttons oben rechts die Zeitachse vergrößern/verkleinern
  (wird gespeichert), um genauer zu sehen, was wann lief
- **Detailgrad** (links umschaltbar): „Zusammengefasst“ (Standard) schluckt
  kurze Weg-Klicks (< 1 Min.) in die laufende Tätigkeit und überbrückt kurze
  Pausen (bis 5 Min.) bei gleicher Tätigkeit – so bleibt z. B. eine Valorant-
  Session ein sauberer Block, auch wenn du zwischendurch kurz wegtabst.
  Aktivitäten ab 1 Min. bleiben sichtbar. „Genau (1:1)“ zeigt jede Aktivität ab
  5 Sek. einzeln. Die **Statistik zählt immer exakt**, unabhängig vom Detailgrad
  – nur die Kalender-Darstellung ändert sich.
- Kategorien per Klick in der Legende ein-/ausblenden

## Technik

| Teil | Beschreibung |
|---|---|
| `tracker.py` | Python (nur Standardbibliothek). Fragt alle 5 s per Win32-API das Vordergrundfenster ab, erkennt Leerlauf, schreibt Sessions als JSON und serviert gleichzeitig das Dashboard auf Port 8771. |
| `data/JJJJ-MM-TT.json` | Eine Datei pro Tag: `{app, title, start, end}` pro Session. Deine Daten, einfach kopier-/löschbar. |
| `index.html` / `style.css` / `app.js` | Dashboard, Vanilla JS ohne Abhängigkeiten. Kategorisierung passiert komplett im Frontend. |
| `categories.json` | Automatisch gelernte Zuordnungen (exe → Kategorie + Anzeigename), gepflegt von der täglichen Claude-Aufgabe. Nur ergänzen, nie nötig, sie von Hand zu pflegen. |

Voraussetzung: Python 3.8+ (ist auf diesem PC vorhanden).
