/* ═══════════════ Zeitblick – Dashboard-Logik ═══════════════ */
"use strict";

const ZOOM_MIN = 48, ZOOM_MAX = 192, ZOOM_STEP = 24, ZOOM_DEFAULT = 96; // px pro Stunde
const BURST_GAP = 300;           // Sek. Pause, ab der eine neue "Nutzung" zählt
const MERGE_GAP = 90;            // Sek. – benachbarte gleiche Blöcke verschmelzen
const ABSORB_1MIN = 60;          // Detailgrad "< 1 Min.": kürzere Wechsel werden geschluckt
const ABSORB_2MIN = 120;         // Detailgrad "< 2 Min.": kürzere Wechsel werden geschluckt
const DETAIL_MIN = 5;            // "Genau": alles ab so vielen Sek. anzeigen
const REFRESH_MS = 30000;        // Auto-Aktualisierung

/* ── Sprache (DE/EN) ── */
const I18N = {
  de: {
    trackerLive: "Tracker läuft – Daten sind live", trackerOff: "Tracker ist nicht aktiv",
    appSub: "Aktivitäts-Tracker", loadingData: "Lade Daten …", checkingTracker: "Prüfe Tracker …",
    tabAnsicht: "Ansicht", tabFokus: "Fokus-Modus",
    blockColor: "Farbe der Blöcke", byCategory: "nach Kategorie", byApp: "nach Programm",
    byAppHint: "„nach Programm“ gibt jedem Spiel, Programm und jeder Website eine eigene Farbe.",
    categories: "Kategorien",
    categoriesHint: "Klicken, um eine Kategorie im Kalender aus- bzw. einzublenden.",
    detailLevel: "Detailgrad", detail1: "< 1 Min.", detail2: "< 2 Min.", detailExact: "Genau",
    detail1Title: "Weg-Klicks unter 1 Minute zusammenfassen", detail2Title: "Weg-Klicks unter 2 Minuten zusammenfassen",
    detailExactTitle: "Jede Aktivität einzeln zeigen",
    detailHint: "„Zusammengefasst“ schluckt kurze Weg-Klicks in die laufende Tätigkeit – z. B. bleibt Valorant ein Block, auch wenn du zwischendurch kurz wegtabst. Wähle, ob Wechsel unter 1 oder unter 2 Minuten geschluckt werden. „Genau“ zeigt jede Aktivität ab 5 Sek. einzeln.",
    trackerStart: "Tracker starten",
    trackerStartHint: "Doppelklick auf <code>start-tracker.cmd</code> im Projektordner – läuft dann unsichtbar im Hintergrund.",
    today: "Heute", calendar: "Kalender", statistics: "Statistik",
    prevWeek: "Vorherige Woche", nextWeek: "Nächste Woche",
    zoomOut: "Herauszoomen", zoomIn: "Hineinzoomen (genauere Zeitansicht)",
    weekTotalLabel: { tag: "Tag gesamt", woche: "Woche gesamt", monat: "Monat gesamt" },
    noDataPeriod: "Noch keine Daten in diesem Zeitraum",
    day: "Tag", week: "Woche", month: "Monat",
    activityPerHour: "Aktivität pro Stunde", activityPerDay: "Aktivität pro Tag",
    activityPerDayMonth: "Aktivität pro Tag im Monat", clickBarForDay: "Balken anklicken für den Tag →",
    topAppsDay: "Top-Programme & Websites am Tag", topAppsMonth: "Top-Programme & Websites im Monat",
    topAppsWeek: "Top-Programme & Websites der Woche",
    byDuration: "nach Dauer", byFrequency: "nach Häufigkeit",
    categoriesDetail: "Kategorien im Detail – welche Programme & Websites stecken dahinter",
    distribution: "Verteilung",
    noDataYet: "Keine Daten in diesem Zeitraum – sobald der Tracker läuft, erscheinen hier Diagramme und Auswertungen.",
    inBrowser: "Im Browser – wofür du den Browser nutzt", total: "gesamt",
    topSites: "Meistbesuchte Websites & Seiten", tracked: "getrackt", topApps: "Top-Programme & Websites",
    entries: "Einträge", activities: "Aktivitäten", websites: "Websites",
    appsAndSites: "Programme & Websites",
    ofWhichWebsites: n => `davon ${n} Websites`,
    noActivity: "Keine Aktivität aufgezeichnet.",
    autoAppearHint: "Sobald der Tracker läuft (<code>start-tracker.cmd</code>), erscheinen hier automatisch deine Aktivitäten.",
    usedTimes: "× benutzt", changeCategory: "Kategorie ändern",
    newBadgeTitle: "Wird bei der nächsten automatischen Prüfung von Claude kategorisiert",
    webNote: "🌐 = Website (im Browser erkannt). Jedes Programm <b>und jede Website</b> lässt sich über das Dropdown in eine Kategorie einsortieren – wird lokal gespeichert und sofort überall angewendet.",
    activeDaysOfN: (a, b) => `${a} von ${b} Tagen aktiv`, avgPerActiveDay: n => `Ø ${n} pro aktivem Tag`,
    focusMode: "Fokus-Modus", startFocus: "▶ Fokus starten", endSession: "Sitzung beenden",
    focusRunning: "Fokus läuft", breakRunning: "Pause läuft",
    notifyOnDistraction: "Benachrichtigung bei Ablenkung",
    autoMinimize: "Ablenkende Fenster automatisch minimieren",
    blockedKeywords: "Blockierte Stichworte", addKeywordPlaceholder: "z. B. facebook",
    focusHint: "Fenster, deren Name oder Titel eines dieser Stichworte enthält, werden während einer Fokus-Sitzung automatisch minimiert, inklusive kurzer Erinnerung mit Ausnahme-Option.",
    noKeywordsYet: "Noch keine Stichworte – füge unten welche hinzu.",
    dailyGoal: "Tagesziel", goalLine: (t, g, p) => `${t} von ${g} Std. · ${p} %`,
    goalLabel: "Ziel:", perDay: "Std./Tag",
    min: "Min.", sec: "Sek.", h: "Std.", used: "genutzt", uhr: "Uhr",
  },
  en: {
    trackerLive: "Tracker running – data is live", trackerOff: "Tracker is not active",
    appSub: "Activity Tracker", loadingData: "Loading data …", checkingTracker: "Checking tracker …",
    tabAnsicht: "View", tabFokus: "Focus Mode",
    blockColor: "Block color", byCategory: "by category", byApp: "by program",
    byAppHint: "“By program” gives every game, program and website its own color.",
    categories: "Categories",
    categoriesHint: "Click to show or hide a category on the calendar.",
    detailLevel: "Detail level", detail1: "< 1 min", detail2: "< 2 min", detailExact: "Exact",
    detail1Title: "Absorb switches under 1 minute", detail2Title: "Absorb switches under 2 minutes",
    detailExactTitle: "Show every activity individually",
    detailHint: "“Grouped” absorbs short switches into the current activity – e.g. Valorant stays one block even if you briefly tab away. Choose whether switches under 1 or under 2 minutes get absorbed. “Exact” shows every activity from 5 sec. individually.",
    trackerStart: "Start tracker",
    trackerStartHint: "Double-click <code>start-tracker.cmd</code> in the project folder – runs invisibly in the background from then on.",
    today: "Today", calendar: "Calendar", statistics: "Statistics",
    prevWeek: "Previous week", nextWeek: "Next week",
    zoomOut: "Zoom out", zoomIn: "Zoom in (more detailed timeline)",
    weekTotalLabel: { tag: "Day total", woche: "Week total", monat: "Month total" },
    noDataPeriod: "No data yet for this period",
    day: "Day", week: "Week", month: "Month",
    activityPerHour: "Activity per hour", activityPerDay: "Activity per day",
    activityPerDayMonth: "Activity per day this month", clickBarForDay: "Click a bar for that day →",
    topAppsDay: "Top apps & websites today", topAppsMonth: "Top apps & websites this month",
    topAppsWeek: "Top apps & websites this week",
    byDuration: "by duration", byFrequency: "by frequency",
    categoriesDetail: "Categories in detail – which apps & websites make them up",
    distribution: "Distribution",
    noDataYet: "No data for this period yet – once the tracker runs, charts and stats will appear here.",
    inBrowser: "In the browser – what you use it for", total: "total",
    topSites: "Most visited websites & pages", tracked: "tracked", topApps: "Top apps & websites",
    entries: "entries", activities: "activities", websites: "websites",
    appsAndSites: "apps & websites",
    ofWhichWebsites: n => `${n} of them websites`,
    noActivity: "No activity recorded.",
    autoAppearHint: "Once the tracker is running (<code>start-tracker.cmd</code>), your activity will appear here automatically.",
    usedTimes: "× used", changeCategory: "Change category",
    newBadgeTitle: "Will be categorized during Claude's next automatic check",
    webNote: "🌐 = website (detected in the browser). Every program <b>and every website</b> can be sorted into a category via the dropdown – saved locally and applied everywhere immediately.",
    activeDaysOfN: (a, b) => `${a} of ${b} days active`, avgPerActiveDay: n => `Avg. ${n} per active day`,
    focusMode: "Focus Mode", startFocus: "▶ Start focus", endSession: "End session",
    focusRunning: "Focus running", breakRunning: "Break running",
    notifyOnDistraction: "Notify on distraction",
    autoMinimize: "Auto-minimize distracting windows",
    blockedKeywords: "Blocked keywords", addKeywordPlaceholder: "e.g. facebook",
    focusHint: "Any window whose name or title contains one of these keywords is automatically minimized during a focus session, with a short reminder and an exception option.",
    noKeywordsYet: "No keywords yet – add some below.",
    dailyGoal: "Daily goal", goalLine: (t, g, p) => `${t} of ${g}h · ${p}%`,
    goalLabel: "Goal:", perDay: "h/day",
    min: "min", sec: "s", h: "h", used: "used", uhr: "",
  },
};
function t(key) { return I18N[state.lang][key]; }
function tf(key, ...args) { return I18N[state.lang][key](...args); }
function locale() { return state.lang === "en" ? "en-US" : "de-DE"; }

/* ── Kategorien (Farben + Namen) ── */
const CATEGORIES = {
  produktiv:      { name: "Produktivität",   nameEn: "Productivity",     color: "#4d7cfe" },
  design:         { name: "Design & Kreativ", nameEn: "Design & Creative", color: "#8b5cf6" },
  lernen:         { name: "Lernen",          nameEn: "Learning",         color: "#06b6d4" },
  kommunikation:  { name: "Kommunikation",   nameEn: "Communication",    color: "#22c55e" },
  soziale_medien: { name: "Soziale Medien",  nameEn: "Social Media",     color: "#ec4899" },
  browsing:       { name: "Browsing",        nameEn: "Browsing",         color: "#f59e0b" },
  gaming:         { name: "Gaming",          nameEn: "Gaming",           color: "#ef4444" },
  unterhaltung:   { name: "Unterhaltung",    nameEn: "Entertainment",    color: "#a855f7" },
  windows:        { name: "Windows",         nameEn: "Windows",          color: "#7891ab" },
  system:         { name: "Sonstiges",       nameEn: "Other",            color: "#565b6b" },
};
function catName(key) {
  const c = CATEGORIES[key];
  return state.lang === "en" ? c.nameEn : c.name;
}

const BROWSERS = new Set([
  "chrome.exe", "firefox.exe", "msedge.exe", "opera.exe", "opera_gx.exe",
  "brave.exe", "vivaldi.exe", "zen.exe", "librewolf.exe", "iexplore.exe",
]);

/* Standard-Zuordnung: exe → Kategorie (per Klick im Dashboard änderbar) */
const DEFAULT_APP_CATEGORIES = {
  // Produktivität
  "code.exe": "produktiv", "claude.exe": "produktiv", "devenv.exe": "produktiv",
  "idea64.exe": "produktiv", "pycharm64.exe": "produktiv", "webstorm64.exe": "produktiv",
  "sublime_text.exe": "produktiv", "notepad.exe": "produktiv", "notepad++.exe": "produktiv",
  "winword.exe": "produktiv", "excel.exe": "produktiv", "powerpnt.exe": "produktiv",
  "onenote.exe": "produktiv", "obsidian.exe": "produktiv", "notion.exe": "produktiv",
  "unity.exe": "produktiv", "unrealeditor.exe": "produktiv", "godot.exe": "produktiv",
  "windowsterminal.exe": "produktiv", "wt.exe": "produktiv", "cmd.exe": "produktiv",
  "powershell.exe": "produktiv", "pwsh.exe": "produktiv", "acrobat.exe": "produktiv",
  "soffice.bin": "produktiv",
  // Design & Kreativ
  "figma.exe": "design", "gimp.exe": "design", "photoshop.exe": "design",
  "illustrator.exe": "design", "blender.exe": "design", "indesign.exe": "design",
  "afterfx.exe": "design", "adobepremierepro.exe": "design", "resolve.exe": "design",
  "kdenlive.exe": "design", "inkscape.exe": "design", "canva.exe": "design",
  "krita.exe": "design", "affinity photo.exe": "design", "affinity designer.exe": "design",
  "cliphq.exe": "design", "capcut.exe": "design",
  // Lernen
  "anki.exe": "lernen", "kindle.exe": "lernen", "duolingo.exe": "lernen",
  // Kommunikation
  "discord.exe": "kommunikation", "teams.exe": "kommunikation", "ms-teams.exe": "kommunikation",
  "slack.exe": "kommunikation", "whatsapp.exe": "kommunikation", "telegram.exe": "kommunikation",
  "signal.exe": "kommunikation", "thunderbird.exe": "kommunikation", "outlook.exe": "kommunikation",
  "olk.exe": "kommunikation", "zoom.exe": "kommunikation", "skype.exe": "kommunikation",
  // Browsing
  ...Object.fromEntries([...BROWSERS].map(b => [b, "browsing"])),
  // Gaming
  "steam.exe": "gaming", "steamwebhelper.exe": "gaming", "epicgameslauncher.exe": "gaming",
  "battle.net.exe": "gaming", "riotclientservices.exe": "gaming", "leagueclient.exe": "gaming",
  "league of legends.exe": "gaming", "valorant.exe": "gaming",
  "valorant-win64-shipping.exe": "gaming", "cs2.exe": "gaming", "csgo.exe": "gaming",
  "minecraft.exe": "gaming", "minecraftlauncher.exe": "gaming", "javaw.exe": "gaming",
  "fortniteclient-win64-shipping.exe": "gaming", "gta5.exe": "gaming",
  "rocketleague.exe": "gaming", "eldenring.exe": "gaming", "r5apex.exe": "gaming",
  "r5apex_dx12.exe": "gaming", "easyanticheat_launcher.exe": "gaming",
  "fc25.exe": "gaming", "fc24.exe": "gaming", "eafc.exe": "gaming",
  "curseforge.exe": "gaming", "goggalaxy.exe": "gaming",
  // Unterhaltung
  "spotify.exe": "unterhaltung", "vlc.exe": "unterhaltung", "wmplayer.exe": "unterhaltung",
  "netflix.exe": "unterhaltung", "amazonmusic.exe": "unterhaltung",
  // Windows (System-Programme von Windows selbst)
  "explorer.exe": "windows", "taskmgr.exe": "windows", "systemsettings.exe": "windows",
  "searchhost.exe": "windows", "searchapp.exe": "windows", "startmenuexperiencehost.exe": "windows",
  "applicationframehost.exe": "windows", "shellexperiencehost.exe": "windows",
  "dwm.exe": "windows", "sihost.exe": "windows", "ctfmon.exe": "windows",
  "textinputhost.exe": "windows", "lockapp.exe": "windows", "control.exe": "windows",
  "rundll32.exe": "windows", "mmc.exe": "windows", "snippingtool.exe": "windows",
  "screenclippinghost.exe": "windows", "conhost.exe": "windows",
  "settingssynchost.exe": "windows", "widgets.exe": "windows", "phonelink.exe": "windows",
  // Sonstiges (Fallback fuer Unbekanntes / Hintergrundprozesse)
  "pythonw.exe": "system", "python.exe": "system",
};

/* Titel-Regeln – nur für Browser-Fenster (Tab-Titel), überstimmen die App-Regel.
   Reihenfolge = Priorität (erste Übereinstimmung gewinnt). */
const TITLE_RULES = [
  [/instagram|tiktok| reddit|reddit\.com|snapchat|pinterest|tumblr|facebook| x \(|\/x\.com|twitter|9gag|threads/i, "soziale_medien"],
  [/udemy|coursera|khan academy|edx|moodle|stack ?overflow|w3schools|mdn web|geeksforgeeks|leetcode|wikipedia|duolingo|tutorial|dokumentation|documentation|\bdocs\b/i, "lernen"],
  [/youtube|netflix|twitch|prime video|disney\+|crunchyroll|kick\.com|wakanim|dazn|spotify/i, "unterhaltung"],
  [/figma|canva|behance|dribbble|pinterest board/i, "design"],
  [/github|gitlab|claude|chatgpt|copilot|notion|google docs|google sheets|jira|trello|linear/i, "produktiv"],
  [/whatsapp|telegram|discord|gmail|outlook|posteingang|web\.whatsapp/i, "kommunikation"],
  [/steam|epic games|op\.gg|twitchtracker|tracker\.gg/i, "gaming"],
];

/* Hübsche Anzeigenamen */
const APP_NAMES = {
  "chrome.exe": "Google Chrome", "msedge.exe": "Microsoft Edge", "firefox.exe": "Firefox",
  "opera.exe": "Opera", "opera_gx.exe": "Opera GX", "brave.exe": "Brave",
  "code.exe": "VS Code", "claude.exe": "Claude", "devenv.exe": "Visual Studio",
  "winword.exe": "Word", "excel.exe": "Excel", "powerpnt.exe": "PowerPoint",
  "olk.exe": "Outlook", "outlook.exe": "Outlook", "ms-teams.exe": "Teams",
  "explorer.exe": "Windows Explorer", "taskmgr.exe": "Task-Manager",
  "searchapp.exe": "Windows-Suche", "searchhost.exe": "Windows-Suche",
  "startmenuexperiencehost.exe": "Startmenü", "shellexperiencehost.exe": "Windows-Shell",
  "textinputhost.exe": "Texteingabe", "dwm.exe": "Windows-Oberfläche",
  "systemsettings.exe": "Einstellungen", "windowsterminal.exe": "Terminal",
  "wt.exe": "Terminal", "cmd.exe": "Eingabeaufforderung", "powershell.exe": "PowerShell",
  "discord.exe": "Discord", "spotify.exe": "Spotify", "steam.exe": "Steam",
  "steamwebhelper.exe": "Steam", "epicgameslauncher.exe": "Epic Games",
  "leagueclient.exe": "League of Legends", "league of legends.exe": "League of Legends",
  "valorant-win64-shipping.exe": "Valorant", "cs2.exe": "Counter-Strike 2",
  "javaw.exe": "Minecraft (Java)", "notepad.exe": "Editor", "notepad++.exe": "Notepad++",
  "r5apex.exe": "Apex Legends", "r5apex_dx12.exe": "Apex Legends",
  "vlc.exe": "VLC", "whatsapp.exe": "WhatsApp", "applicationframehost.exe": "Windows-App",
  "python.exe": "Python", "pythonw.exe": "Python (Hintergrund)",
};

/* ── Zustand ── */
const state = {
  weekStart: mondayOf(new Date()),
  selectedDay: isoDate(new Date()),
  days: {},          // iso → [Session]  (roh, mit cat)
  generated: {},     // iso → Date der letzten Tracker-Schreibung
  learned: {},       // exe → {cat, name} aus categories.json (automatisch gepflegt)
  overrides: loadJSON("zeitblick.appOverrides", {}),
  hiddenCats: new Set(loadJSON("zeitblick.hiddenCats", [])),
  // "min1" (< 1 Min. zusammenfassen) | "min2" (< 2 Min.) | "genau" (1:1); altes "grob" -> "min1"
  detail: (() => { const v = loadJSON("zeitblick.detail", "min1"); return v === "grob" ? "min1" : (["min1", "min2", "genau"].includes(v) ? v : "min1"); })(),
  hourH: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, loadJSON("zeitblick.hourH", ZOOM_DEFAULT))),
  view: loadJSON("zeitblick.view", "kalender"),   // "kalender" | "statistik"
  statsPeriod: loadJSON("zeitblick.statsPeriod", "woche"), // "tag" | "woche" | "monat"
  appSort: loadJSON("zeitblick.appSort", "dur"),  // "dur" | "bursts"
  colorMode: loadJSON("zeitblick.colorMode", "kategorie"), // "kategorie" | "app"
  lang: loadJSON("zeitblick.lang", "de"), // "de" | "en"
};

/* Palette klar unterscheidbarer Farben für den Programm-Modus */
const APP_PALETTE = [
  "#4d7cfe", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4",
  "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#8b5cf6", "#eab308",
  "#3b82f6", "#f43f5e", "#10b981", "#d946ef", "#0ea5e9", "#fb923c",
  "#a3e635", "#e879f9", "#2dd4bf", "#fda4af",
];
function hashInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}
/* Farbzuordnung pro Woche: die meistgenutzten Aktivitäten bekommen der Reihe
   nach verschiedene Palettenfarben – so sind die wichtigsten garantiert
   unterscheidbar und in Kalender wie Statistik identisch gefärbt. */
function rebuildAppColors() {
  const set = new Map();
  for (const d of weekDays()) set.set(isoDate(d), d);
  for (const d of periodDays()) set.set(isoDate(d), d);
  const all = [...set.values()].flatMap(d => state.days[isoDate(d)] || []);
  const agg = aggregate(all);
  const keys = Object.keys(agg.apps).sort((a, b) => agg.apps[b].dur - agg.apps[a].dur);
  const map = {};
  keys.forEach((k, i) => { map[k] = APP_PALETTE[i % APP_PALETTE.length]; });
  state.appColorMap = map;
}
/* Stabile Farbe pro Programm/Website */
function appColor(key) {
  const m = state.appColorMap;
  if (m && m[key]) return m[key];
  return APP_PALETTE[hashInt(key || "?") % APP_PALETTE.length]; // Fallback
}

/* Farben eines Kalender-Blocks je nach Modus (Kategorie- oder Programm-Farbe) */
function blockColors(b) {
  const c = state.colorMode === "app" ? appColor(b.key || b.app) : CATEGORIES[b.cat].color;
  return { border: c, bg: c + "26", text: c };
}

/* Punkt-/Balkenfarbe einer Aktivitaet in den Statistiken */
function activityColor(a) {
  if (state.colorMode === "app") return appColor(a.key || a.app);
  const mainCat = Object.entries(a.cats).sort((x, y) => y[1] - x[1])[0][0];
  return CATEGORIES[mainCat].color;
}

function applyHourHeight() {
  document.documentElement.style.setProperty("--hour-h", state.hourH + "px");
}

/* ═══════════════ Hilfsfunktionen ═══════════════ */

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (x.getDay() + 6) % 7; // Mo=0 … So=6
  x.setDate(x.getDate() - shift);
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekDays() { return [...Array(7)].map((_, i) => addDays(state.weekStart, i)); }
function currentAnchor() { return new Date(state.selectedDay + "T12:00:00"); }
function monthDays(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const out = [];
  for (let x = new Date(first); x.getMonth() === first.getMonth(); x.setDate(x.getDate() + 1)) out.push(new Date(x));
  return out;
}
/* Tage des aktuell gewählten Zeitraums (Tag / Woche / Monat) */
function periodDays() {
  if (state.view === "statistik" && state.statsPeriod === "tag") return [currentAnchor()];
  if (state.view === "statistik" && state.statsPeriod === "monat") return monthDays(currentAnchor());
  return weekDays();
}
function periodLabel() {
  if (state.view === "statistik" && state.statsPeriod === "tag")
    return currentAnchor().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  if (state.view === "statistik" && state.statsPeriod === "monat")
    return currentAnchor().toLocaleDateString(locale(), { month: "long", year: "numeric" });
  const a = weekDays()[0], b = weekDays()[6], o = { day: "numeric", month: "short" };
  return `${a.toLocaleDateString(locale(), o)} – ${b.toLocaleDateString(locale(), { ...o, year: "numeric" })}`;
}

function fmtDur(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} ${t("sec")}`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m} ${t("min")}`;
  return m === 0 ? `${h} ${t("h")}` : `${h} ${t("h")} ${m} ${t("min")}`;
}
function fmtClock(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtShort(sec) {
  const dec = state.lang === "en" ? "." : ",";
  if (sec >= 3600) return (sec / 3600).toFixed(1).replace(".", dec) + " h";
  if (sec >= 60) return Math.round(sec / 60) + " min";
  return Math.round(sec) + " s";
}

/* Sessions zu Gesamtzeit, Kategorie-Summen und Aktivitaets-Summen verdichten.
   "apps" ist nach Aktivitaet gruppiert (Browser nach Website aufgeteilt). */
function aggregate(sessions) {
  const catTotals = {}, apps = {};
  let total = 0;
  for (const s of sessions) {
    total += s.dur;
    catTotals[s.cat] = (catTotals[s.cat] || 0) + s.dur;
    const key = activityKey(s);
    const a = apps[key] || (apps[key] = {
      key, label: activityLabel(s), app: s.app, web: isWeb(s),
      dur: 0, bursts: 0, lastEnd: null, cats: {},
    });
    a.dur += s.dur;
    a.cats[s.cat] = (a.cats[s.cat] || 0) + s.dur;
    if (!a.lastEnd || (s.start - a.lastEnd) / 1000 > BURST_GAP) a.bursts++;
    if (!a.lastEnd || s.end > a.lastEnd) a.lastEnd = s.end;
  }
  return { total, catTotals, apps };
}

/* Donut-Diagramm als SVG-String */
function donutSVG(catTotals, total, size = 150, stroke = 16) {
  const c = size / 2, R = c - stroke / 2 - 2, CIRC = 2 * Math.PI * R;
  const order = Object.keys(CATEGORIES).filter(k => catTotals[k] > 0)
    .sort((a, b) => catTotals[b] - catTotals[a]);
  let off = 0, segs = "";
  for (const k of order) {
    const frac = catTotals[k] / total;
    segs += `<circle r="${R}" cx="${c}" cy="${c}" fill="none"
      stroke="${CATEGORIES[k].color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0, frac * CIRC - 2)} ${CIRC}"
      stroke-dashoffset="${-off * CIRC}" transform="rotate(-90 ${c} ${c})"></circle>`;
    off += frac;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle r="${R}" cx="${c}" cy="${c}" fill="none" stroke="#262a3a" stroke-width="${stroke}"></circle>
    ${segs}</svg>`;
}

function catRowHTML(cat, sec, total) {
  return `
    <div class="cat-row">
      <span class="legend-dot" style="background:${CATEGORIES[cat].color}"></span>
      <span class="cr-name">${catName(cat)}</span>
      <span class="cr-time">${fmtDur(sec)}</span>
      <span class="cr-pct">${Math.round(sec / total * 100)} %</span>
    </div>`;
}

function appName(exe) {
  if (APP_NAMES[exe]) return APP_NAMES[exe];
  if (state.learned[exe] && state.learned[exe].name) return state.learned[exe].name;
  const base = exe.replace(/\.exe$/i, "").replace(/[-_]+/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/* Kategorie einer App: Nutzer-Wahl > automatisch gelernt > eingebaute Liste */
function appCategory(exe) {
  if (state.overrides[exe] && CATEGORIES[state.overrides[exe]]) return state.overrides[exe];
  if (state.learned[exe] && CATEGORIES[state.learned[exe].cat]) return state.learned[exe].cat;
  return DEFAULT_APP_CATEGORIES[exe] || "system";
}

/* Ist die App irgendwo bekannt (sonst gilt sie als "neu")? */
function isKnown(exe) {
  return !!(state.overrides[exe] || state.learned[exe] || DEFAULT_APP_CATEGORIES[exe]);
}

function categorize(app, title) {
  if (BROWSERS.has(app) && title) {
    // manuelle Website-Zuordnung hat Vorrang vor den automatischen Titel-Regeln
    const site = browserSite(title);
    if (site) {
      const wkey = "web::" + site.toLowerCase();
      if (state.overrides[wkey] && CATEGORIES[state.overrides[wkey]]) return state.overrides[wkey];
    }
    for (const [re, cat] of TITLE_RULES) if (re.test(title)) return cat;
  }
  return appCategory(app);
}

/* Bekannte Websites am Fenstertitel erkennen (Chrome & Co. haengen den
   Tab-Titel ins Fenster: "Video - YouTube - Google Chrome"). */
const SITE_RULES = [
  [/youtube/i, "YouTube"],
  [/tiktok/i, "TikTok"],
  [/instagram/i, "Instagram"],
  [/\breddit\b/i, "Reddit"],
  [/twitch/i, "Twitch"],
  [/netflix/i, "Netflix"],
  [/disney\+/i, "Disney+"],
  [/prime video/i, "Prime Video"],
  [/crunchyroll/i, "Crunchyroll"],
  [/spotify/i, "Spotify"],
  [/snapchat/i, "Snapchat"],
  [/pinterest/i, "Pinterest"],
  [/twitter|\bx\.com\b|\/ x\b|— x\b|– x\b/i, "X (Twitter)"],
  [/facebook/i, "Facebook"],
  [/whatsapp/i, "WhatsApp Web"],
  [/telegram/i, "Telegram Web"],
  [/gmail/i, "Gmail"],
  [/outlook|posteingang/i, "Outlook"],
  [/github/i, "GitHub"],
  [/gitlab/i, "GitLab"],
  [/stack ?overflow/i, "Stack Overflow"],
  [/\bmdn\b|mdn web/i, "MDN"],
  [/w3schools/i, "W3Schools"],
  [/wikipedia/i, "Wikipedia"],
  [/udemy/i, "Udemy"],
  [/coursera/i, "Coursera"],
  [/khan academy/i, "Khan Academy"],
  [/leetcode/i, "LeetCode"],
  [/chatgpt|openai/i, "ChatGPT"],
  [/claude\.ai|claude/i, "Claude"],
  [/notion/i, "Notion"],
  [/figma/i, "Figma"],
  [/canva/i, "Canva"],
  [/google docs|google sheets|google slides|google drive/i, "Google Workspace"],
  [/google (suche|search)|^google\b/i, "Google Suche"],
  [/amazon/i, "Amazon"],
  [/ebay/i, "eBay"],
  [/steam/i, "Steam"],
  [/op\.gg|tracker\.gg/i, "Game-Stats"],
];

const BROWSER_SUFFIX = /\s*[-–—]\s*(Google Chrome|Mozilla Firefox|Microsoft\s*Edge|Opera GX|Opera|Brave|Vivaldi|Chromium|Firefox|Edge)\s*$/i;

/* Aus einem Browser-Fenstertitel einen kurzen Seitennamen ableiten */
function browserSite(title) {
  if (!title) return null;
  let t = title.replace(/^\(\d+\)\s*/, "").trim();          // "(3) " (Benachrichtigungen) weg
  for (const [re, name] of SITE_RULES) if (re.test(t)) return name;
  t = t.replace(BROWSER_SUFFIX, "").trim();                  // " - Google Chrome" weg
  if (!t || /^neuer tab|new tab$/i.test(t)) return null;
  // Seiten-/Markenname ist meist das letzte Segment nach einem Trenner
  const parts = t.split(/\s+[|·:–—-]\s+/).map(s => s.trim()).filter(Boolean);
  let label = parts.length ? parts[parts.length - 1] : t;
  if (label.length > 24) label = label.slice(0, 23) + "…";
  return label || null;
}

/* Eine Aktivitaet = App; Browser werden zusaetzlich nach Website aufgeteilt,
   damit man "YouTube", "TikTok" usw. einzeln sieht statt nur "Google Chrome". */
function activityKey(s) {
  if (BROWSERS.has(s.app)) {
    const site = browserSite(s.title);
    if (site) return "web::" + site.toLowerCase();
  }
  return s.app;
}
function activityLabel(s) {
  if (BROWSERS.has(s.app)) {
    const site = browserSite(s.title);
    if (site) return site;
  }
  return appName(s.app);
}
function isWeb(s) { return BROWSERS.has(s.app) && !!browserSite(s.title); }

/* ═══════════════ Daten laden ═══════════════ */

/* Automatisch gelernte Zuordnungen (categories.json, gepflegt von der
   geplanten Claude-Aufgabe) nachladen – Datei ist optional */
async function fetchLearned() {
  try {
    const res = await fetch(`categories.json?t=${Date.now()}`);
    if (!res.ok) throw 0;
    const j = await res.json();
    state.learned = j.apps || {};
  } catch { state.learned = state.learned || {}; }
}

async function fetchDay(iso) {
  try {
    const res = await fetch(`data/${iso}.json?t=${Date.now()}`);
    if (!res.ok) throw 0;
    const j = await res.json();
    state.generated[iso] = j.generated ? new Date(j.generated) : null;
    state.days[iso] = (j.sessions || []).map(s => {
      const start = new Date(s.start), end = new Date(s.end);
      return {
        app: s.app, title: s.title || "",
        start, end,
        dur: Math.max(0, (end - start) / 1000),
        cat: categorize(s.app, s.title || ""),
      };
    }).filter(s => s.dur > 0);
  } catch {
    state.days[iso] = [];
    state.generated[iso] = null;
  }
}

/* Alle Tage laden, die die aktuelle Ansicht braucht (Kalenderwoche + Statistik-Zeitraum) */
async function loadContext() {
  await fetchLearned();
  const need = new Map();
  for (const d of weekDays()) need.set(isoDate(d), d);
  for (const d of periodDays()) need.set(isoDate(d), d);
  await Promise.all([...need.keys()].map(iso => fetchDay(iso)));
  render();
}

async function loadWeek() { await loadContext(); }

/* Auto-Refresh: nur der heutige Tag ändert sich laufend */
async function refreshToday() {
  const todayIso = isoDate(new Date());
  await fetchLearned();
  await fetchDay(todayIso);
  recategorizeAll();
  render();
}

function recategorizeAll() {
  for (const iso of Object.keys(state.days))
    for (const s of state.days[iso]) s.cat = categorize(s.app, s.title);
}

/* Benachbarte Blöcke gleicher App+Kategorie fürs Rendern verschmelzen */
function mergedForDisplay(sessions) {
  const grob = state.detail !== "genau";
  // Absorptions-Schwelle je nach Detailgrad: "< 1 Min." oder "< 2 Min."
  const absorbMax = state.detail === "min2" ? ABSORB_2MIN : ABSORB_1MIN;
  // "Zusammengefasst" überbrückt größere Lücken bei gleicher Tätigkeit, damit
  // z. B. eine Valorant-Session trotz kurzer Pausen ein Block bleibt.
  const mergeGap = grob ? BURST_GAP : MERGE_GAP;
  const out = [];
  for (const s of sessions) {
    const key = activityKey(s);
    const last = out[out.length - 1];
    const gap = last ? (s.start - last.end) / 1000 : Infinity;

    // 1) gleiche Aktivität mit tolerierbarer Lücke → an laufenden Block anhängen
    if (last && last.key === key && gap <= mergeGap) {
      if (s.end > last.end) { last.end = s.end; last.dur = (last.end - last.start) / 1000; }
      last.active = (last.active || 0) + s.dur;
      last.title = s.title || last.title;
      continue;
    }
    // 2) "Zusammengefasst": kurzer Weg-Klick (< absorbMax) → in laufenden Block schlucken
    if (grob && last && s.dur < absorbMax && gap <= mergeGap) {
      last.end = s.end; last.dur = (last.end - last.start) / 1000;
      continue;
    }
    out.push({ ...s, key, label: activityLabel(s), web: isWeb(s), active: s.dur });
  }
  // Endfilter: im Genau-Modus alles ab DETAIL_MIN, sonst winzige Reste aussortieren
  const floor = grob ? 15 : DETAIL_MIN;
  return out.filter(b => b.dur >= floor);
}

/* ═══════════════ Rendern ═══════════════ */

const $ = sel => document.querySelector(sel);

function render() {
  if (state.colorMode === "app") rebuildAppColors();
  renderTopbar();
  if (state.view === "statistik") {
    renderStatsView();
  } else {
    renderHeaders();
    renderCalendar();
  }
  renderStats();
  renderLegend();
  renderStatus();
}

/* Sichtbarkeit Kalender vs. Statistik-Ansicht */
function applyView() {
  const cal = state.view !== "statistik";
  document.querySelector(".cal-header-row").hidden = !cal;
  $("#calScroll").hidden = !cal;
  $("#statsView").hidden = cal;
  document.querySelector(".zoom-btns").hidden = !cal;
  $("#viewCal").classList.toggle("active", cal);
  $("#viewStats").classList.toggle("active", !cal);
}

async function setView(v) {
  state.view = v;
  saveJSON("zeitblick.view", v);
  applyView();
  await loadContext();               // Monats-/Tagesdaten ggf. nachladen
  if (v !== "statistik") autoScroll();
}

function renderTopbar() {
  $("#weekLabel").textContent = periodLabel();

  const days = periodDays();
  let total = 0;
  for (const d of days) for (const s of (state.days[isoDate(d)] || [])) total += s.dur;
  const key = state.view === "statistik" ? state.statsPeriod : "woche";
  const label = t("weekTotalLabel")[key] || t("weekTotalLabel").woche;
  $("#weekTotal").innerHTML = total > 0
    ? `${label}: <b>${fmtDur(total)}</b>` : t("noDataPeriod");
}

function renderHeaders() {
  const wrap = $("#calHeader");
  wrap.innerHTML = "";
  const todayIso = isoDate(new Date());
  for (const d of weekDays()) {
    const iso = isoDate(d);
    const total = (state.days[iso] || []).reduce((a, s) => a + s.dur, 0);
    const el = document.createElement("div");
    el.className = "day-head"
      + (iso === todayIso ? " today" : "")
      + (iso === state.selectedDay ? " selected" : "");
    el.innerHTML = `
      <div class="dh-name">${d.toLocaleDateString(locale(), { weekday: "short" })}</div>
      <div class="dh-num">${d.getDate()}</div>
      <div class="dh-total">${total > 0 ? fmtDur(total) : ""}</div>`;
    el.addEventListener("click", () => { state.selectedDay = iso; render(); });
    wrap.appendChild(el);
  }
}

function renderCalendar() {
  const timeCol = $("#timeCol");
  if (!timeCol.childElementCount) {
    for (let h = 1; h < 24; h++) {
      const l = document.createElement("div");
      l.className = "time-label";
      // Achse laeuft von unten nach oben: fruehe Stunden unten, spaete oben
      l.style.bottom = `calc(var(--hour-h) * ${h})`;
      l.textContent = `${String(h).padStart(2, "0")}:00`;
      timeCol.appendChild(l);
    }
  }

  const grid = $("#daysGrid");
  grid.innerHTML = "";
  const todayIso = isoDate(new Date());
  const now = new Date();

  for (const d of weekDays()) {
    const iso = isoDate(d);
    const col = document.createElement("div");
    col.className = "day-col" + (iso === todayIso ? " today-col" : "");

    let blocks = mergedForDisplay(state.days[iso] || []);
    blocks = blocks.filter(b => !state.hiddenCats.has(b.cat));

    for (const b of blocks) {
      const startMin = b.start.getHours() * 60 + b.start.getMinutes() + b.start.getSeconds() / 60;
      const el = document.createElement("div");
      el.className = "block";
      // Achse laeuft von unten nach oben: Startzeit = Abstand von unten
      const bottom = (startMin / 60) * state.hourH;
      const height = Math.max(3, (b.dur / 3600) * state.hourH - 1);
      const bc = blockColors(b);
      el.style.cssText = `bottom:${bottom}px;height:${height}px;background:${bc.bg};border-left-color:${bc.border};color:${bc.text}`;
      const globe = b.web ? '<span class="b-web">🌐</span>' : "";
      const nm = globe + escapeHtml(b.label || appName(b.app));
      if (height >= 30) {
        // genug Platz: Name + Dauer untereinander (echte aktive Zeit)
        el.innerHTML = `<div class="b-app">${nm}</div><div class="b-dur">${fmtDur(b.active || b.dur)}</div>`;
      } else if (height >= 13) {
        // Name in einer Zeile
        el.innerHTML = `<div class="b-app">${nm}</div>`;
      } else if (height >= 6) {
        // kleiner Block: Name winzig, aber noch lesbar
        el.classList.add("block-mini");
        el.innerHTML = `<div class="b-app">${nm}</div>`;
      }
      attachTooltip(el, b);
      el.addEventListener("click", () => { state.selectedDay = iso; render(); });
      col.appendChild(el);
    }

    if (iso === todayIso) {
      const line = document.createElement("div");
      line.className = "now-line";
      line.style.bottom = `${((now.getHours() * 60 + now.getMinutes()) / 60) * state.hourH}px`;
      col.appendChild(line);
    }
    grid.appendChild(col);
  }
}

function autoScroll() {
  const sc = $("#calScroll");
  const H = state.hourH * 24;
  const sessions = state.days[state.selectedDay] || [];
  let hour = 8;
  if (sessions.length) hour = Math.max(0, sessions[0].start.getHours() - 1);
  const now = new Date();
  if (state.selectedDay === isoDate(now)) hour = Math.min(hour, Math.max(0, now.getHours() - 3));
  // invertierte Achse: gewuenschte Stunde nahe den unteren Bildrand holen
  sc.scrollTop = Math.max(0, H - hour * state.hourH - sc.clientHeight);
}

/* Zoom: Stundenhöhe ändern, Bildmitte beibehalten */
function zoom(delta) {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.hourH + delta));
  if (next === state.hourH) return;
  const sc = $("#calScroll");
  const centerHours = (sc.scrollTop + sc.clientHeight / 2) / state.hourH;
  state.hourH = next;
  saveJSON("zeitblick.hourH", next);
  applyHourHeight();
  renderCalendar();
  sc.scrollTop = centerHours * next - sc.clientHeight / 2;
}

/* ── Statistik-Panel rechts ── */

function renderStats() {
  const panel = $("#statsPanel");
  const iso = state.selectedDay;
  const sessions = state.days[iso] || [];
  const day = new Date(iso + "T12:00:00");
  const dateLabel = day.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });

  if (!sessions.length) {
    panel.innerHTML = `
      <div class="stats-date">${dateLabel}</div>
      <div class="stats-sub">${t("noActivity")}</div>
      <p class="stats-note">${t("autoAppearHint")}</p>`;
    return;
  }

  // Aggregation: Kategorien + Apps
  const { total, catTotals, apps } = aggregate(sessions);
  const catOrder = Object.keys(CATEGORIES).filter(c => catTotals[c] > 0)
    .sort((a, b) => catTotals[b] - catTotals[a]);
  const catRows = catOrder.map(c => catRowHTML(c, catTotals[c], total)).join("");

  const topApps = Object.entries(apps).sort((a, b) => b[1].dur - a[1].dur).slice(0, 16);
  const appRows = topApps.map(([key, a]) => {
    const mainCat = Object.entries(a.cats).sort((x, y) => y[1] - x[1])[0][0];
    const icon = a.web ? '<span class="app-web">🌐</span>' : "";
    // Websites per Website-Key umsortierbar, Programme per exe
    const ovKey = a.web ? a.key : a.app;
    const cur = state.overrides[ovKey] || mainCat;
    const options = Object.keys(CATEGORIES).map(ck =>
      `<option value="${ck}" ${ck === cur ? "selected" : ""}>${catName(ck)}</option>`
    ).join("");
    const right = `<select class="app-cat-select" data-key="${escapeHtml(ovKey)}" title="${t("changeCategory")}">${options}</select>`;
    const neu = (!a.web && !isKnown(a.app)) ? `<span class="badge-new" title="${t("newBadgeTitle")}">NEU</span>` : "";
    return `
      <div class="app-row">
        <span class="app-dot" style="background:${activityColor(a)}"></span>
        <div class="app-info">
          <div class="app-name" title="${escapeHtml(a.label)}">${icon}${escapeHtml(a.label)}${neu}</div>
          <div class="app-meta">${fmtDur(a.dur)} · ${a.bursts}${t("usedTimes")}</div>
        </div>
        ${right}
      </div>`;
  }).join("");

  const webCount = Object.values(apps).filter(a => a.web).length;
  panel.innerHTML = `
    <div class="stats-date">${dateLabel}</div>
    <div class="stats-sub">${sessions.length} ${t("activities")} · ${Object.keys(apps).length} ${t("entries")}${webCount ? ` (${tf("ofWhichWebsites", webCount)})` : ""}</div>
    <div class="donut-wrap">
      ${donutSVG(catTotals, total)}
      <div class="donut-center">
        <div class="dc-time">${fmtDur(total)}</div>
        <div class="dc-label">${t("tracked")}</div>
      </div>
    </div>
    <div class="cat-rows">${catRows}</div>
    <div class="apps-heading">${t("topApps")}</div>
    <div class="app-list">${appRows}</div>
    <p class="stats-note">${t("webNote")}</p>`;

  panel.querySelectorAll(".app-cat-select").forEach(sel => {
    sel.addEventListener("change", () => {
      state.overrides[sel.dataset.key] = sel.value;
      saveJSON("zeitblick.appOverrides", state.overrides);
      recategorizeAll();
      render();
    });
  });
}

/* ── Statistik-Ansicht (Tag / Woche / Monat) ── */

/* Sessions eines Tages auf 24 Stunden-Eimer verteilen (Segmente = Kategorien) */
function hourlyBuckets(sessions) {
  const hours = Array.from({ length: 24 }, () => ({ catTotals: {}, total: 0 }));
  for (const s of sessions) {
    let t = new Date(s.start);
    while (t < s.end) {
      const h = t.getHours();
      const next = new Date(t.getFullYear(), t.getMonth(), t.getDate(), h + 1, 0, 0, 0);
      const seg = (Math.min(s.end, next) - t) / 1000;
      hours[h].total += seg;
      hours[h].catTotals[s.cat] = (hours[h].catTotals[s.cat] || 0) + seg;
      t = next;
    }
  }
  return hours;
}

/* Generisches gestapeltes Balkendiagramm.
   buckets: [{label, sub?, total, catTotals, iso?, date?}]; clickable = Tage anklickbar */
function barChart(buckets, clickable) {
  const W = 720, H = 280, padL = 44, padR = 10, padT = 26, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxSec = Math.max(...buckets.map(b => b.total), 1);
  const maxHours = Math.max(1, Math.ceil(maxSec / 3600));
  const yMax = maxHours * 3600;
  const step = Math.max(1, Math.ceil(maxHours / 4));

  let grid = "";
  for (let h = 0; h <= maxHours; h += step) {
    const y = padT + ih - (h * 3600 / yMax) * ih;
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#262a3a"></line>
      <text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#8b93a7">${h} h</text>`;
  }

  const n = buckets.length, slot = iw / n, barW = Math.max(3, Math.min(46, slot * 0.62));
  const todayIso = isoDate(new Date());
  let bars = "";
  buckets.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    let y = padT + ih;
    for (const key of Object.keys(CATEGORIES)) {
      const sec = b.catTotals[key] || 0;
      if (!sec) continue;
      const hgt = Math.max(1, (sec / yMax) * ih);
      y -= hgt;
      bars += `<rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${hgt}" rx="1.5"
        fill="${CATEGORIES[key].color}" opacity="0.92"><title>${catName(key)}: ${fmtDur(sec)}</title></rect>`;
    }
    if (b.total > 0 && n <= 16)
      bars += `<text x="${cx}" y="${y - 5}" text-anchor="middle" font-size="9" fill="#e8eaf2">${fmtShort(b.total)}</text>`;
    if (b.label) {
      const sel = b.iso && b.iso === state.selectedDay;
      bars += `<text x="${cx}" y="${H - (b.sub ? 20 : 12)}" text-anchor="middle" font-size="${n > 20 ? 8 : 10}"
        font-weight="${sel ? 700 : 400}" fill="${b.iso === todayIso ? "#a78bfa" : "#8b93a7"}">${b.label}</text>`;
      if (b.sub) bars += `<text x="${cx}" y="${H - 7}" text-anchor="middle" font-size="9" fill="#5b6070">${b.sub}</text>`;
    }
    if (clickable && b.iso)
      bars += `<rect x="${padL + slot * i}" y="${padT}" width="${slot}" height="${ih + 30}"
        fill="transparent" style="cursor:pointer" data-bariso="${b.iso}">
        <title>${b.date.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}: ${b.total ? fmtDur(b.total) : (state.lang === "en" ? "no data" : "keine Daten")}</title></rect>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${bars}</svg>`;
}

function renderStatsView() {
  const view = $("#statsView");
  const period = state.statsPeriod;
  const days = periodDays();
  const allSessions = days.flatMap(d => state.days[isoDate(d)] || []);
  const agg = aggregate(allSessions);

  const selector = `
    <div class="period-switch">
      <button class="pseg ${period === "tag" ? "active" : ""}" data-period="tag">${t("day")}</button>
      <button class="pseg ${period === "woche" ? "active" : ""}" data-period="woche">${t("week")}</button>
      <button class="pseg ${period === "monat" ? "active" : ""}" data-period="monat">${t("month")}</button>
    </div>`;

  const wire = () => {
    view.querySelectorAll(".pseg").forEach(b =>
      b.addEventListener("click", () => setPeriod(b.dataset.period)));
    view.querySelectorAll("[data-bariso]").forEach(r =>
      r.addEventListener("click", () => { state.selectedDay = r.dataset.bariso; setPeriod("tag"); }));
    const sortSel = view.querySelector("#appSortSel");
    if (sortSel) sortSel.addEventListener("change", () => {
      state.appSort = sortSel.value; saveJSON("zeitblick.appSort", state.appSort); render();
    });
  };

  if (agg.total === 0) {
    view.innerHTML = selector + `<div class="stats-empty">${t("noDataYet")}</div>`;
    wire(); return;
  }

  // Balkendiagramm-Eimer je nach Zeitraum
  let buckets, clickable = false, chartTitle;
  if (period === "tag") {
    chartTitle = t("activityPerHour");
    buckets = hourlyBuckets(allSessions).map((h, i) => ({
      label: i % 3 === 0 ? String(i).padStart(2, "0") : "", total: h.total, catTotals: h.catTotals,
    }));
  } else {
    clickable = true;
    chartTitle = period === "monat" ? t("activityPerDayMonth") : t("activityPerDay");
    buckets = days.map(d => {
      const a = aggregate(state.days[isoDate(d)] || []);
      return {
        label: period === "monat" ? String(d.getDate()) : d.toLocaleDateString(locale(), { weekday: "short" }),
        sub: period === "woche" ? d.getDate() + "." : "",
        iso: isoDate(d), date: d, total: a.total, catTotals: a.catTotals,
      };
    });
  }

  const catOrder = Object.keys(CATEGORIES).filter(c => agg.catTotals[c] > 0)
    .sort((a, b) => agg.catTotals[b] - agg.catTotals[a]);

  // Top-Programme & Websites (sortierbar)
  const byBursts = state.appSort === "bursts";
  const entries = Object.entries(agg.apps)
    .sort((a, b) => byBursts ? b[1].bursts - a[1].bursts : b[1].dur - a[1].dur)
    .slice(0, 15);
  const maxVal = entries.length ? (byBursts ? entries[0][1].bursts : entries[0][1].dur) : 1;
  const appBars = entries.map(([key, a], i) => {
    const val = byBursts ? a.bursts : a.dur;
    const icon = a.web ? "🌐 " : "";
    const neu = (!a.web && !isKnown(a.app)) ? ` <span class="badge-new">NEU</span>` : "";
    const col = activityColor(a);
    return `
      <div class="hbar-row">
        <span class="hbar-rank">${i + 1}.</span>
        <span class="hbar-dot" style="background:${col}"></span>
        <span class="hbar-name" title="${escapeHtml(a.label)}">${icon}${escapeHtml(a.label)}${neu}</span>
        <div class="hbar-track"><div class="hbar-fill"
          style="width:${Math.max(2, val / maxVal * 100)}%;background:${col}"></div></div>
        <span class="hbar-val">${fmtDur(a.dur)} · ${a.bursts}×</span>
      </div>`;
  }).join("");

  // Kategorien im Detail
  const catDetails = catOrder.map(c => {
    const items = Object.entries(agg.apps).filter(([, a]) => a.cats[c])
      .sort((x, y) => y[1].cats[c] - x[1].cats[c]);
    const catSec = agg.catTotals[c];
    const rows = items.slice(0, 10).map(([key, a]) => {
      const fill = state.colorMode === "app" ? appColor(a.key || a.app) : CATEGORIES[c].color;
      return `
      <div class="catd-app">
        <span class="hbar-name" title="${escapeHtml(a.label)}">${a.web ? "🌐 " : ""}${escapeHtml(a.label)}</span>
        <div class="hbar-track"><div class="hbar-fill"
          style="width:${Math.max(2, a.cats[c] / catSec * 100)}%;background:${fill};opacity:.85"></div></div>
        <span class="hbar-val">${fmtDur(a.cats[c])}</span>
      </div>`;
    }).join("");
    return `
      <div class="catd-section">
        <div class="catd-head">
          <span class="legend-dot" style="background:${CATEGORIES[c].color}"></span>
          ${catName(c)}
          <span class="catd-time">${fmtDur(catSec)} · ${Math.round(catSec / agg.total * 100)} %</span>
        </div>
        ${rows}
      </div>`;
  }).join("");

  const donutLabel = period === "tag" ? t("day") : period === "monat" ? t("month") : t("week");
  const topTitle = period === "tag" ? t("topAppsDay")
    : period === "monat" ? t("topAppsMonth") : t("topAppsWeek");
  const chartHint = clickable ? `<span class="h2-right">${t("clickBarForDay")}</span>` : "";

  // Zusammenfassungszeile
  let summary;
  if (period === "tag") {
    summary = `${allSessions.length} ${t("activities")} · ${Object.keys(agg.apps).length} ${t("appsAndSites")}`;
  } else {
    const activeDays = days.filter(d => (state.days[isoDate(d)] || []).length > 0).length;
    summary = `${tf("activeDaysOfN", activeDays, days.length)} · ${tf("avgPerActiveDay", fmtDur(agg.total / Math.max(1, activeDays)))} · ${Object.keys(agg.apps).length} ${t("appsAndSites")}`;
  }

  // Browser-Auswertung: wofür wird der Browser genutzt (Kategorien + Websites)
  const browserSessions = allSessions.filter(s => BROWSERS.has(s.app));
  const bagg = aggregate(browserSessions);
  let browserCard = "";
  if (bagg.total > 0) {
    const bCatOrder = Object.keys(CATEGORIES).filter(c => bagg.catTotals[c] > 0)
      .sort((x, y) => bagg.catTotals[y] - bagg.catTotals[x]);
    const bSites = Object.entries(bagg.apps).sort((x, y) => y[1].dur - x[1].dur).slice(0, 12);
    const bMax = bSites.length ? bSites[0][1].dur : 1;
    const siteRows = bSites.map(([key, a]) => {
      const mainCat = Object.entries(a.cats).sort((x, y) => y[1] - x[1])[0][0];
      const col = state.colorMode === "app" ? appColor(a.key || a.app) : CATEGORIES[mainCat].color;
      return `
        <div class="hbar-row">
          <span class="hbar-dot" style="background:${col}"></span>
          <span class="hbar-name" title="${escapeHtml(a.label)}">${a.web ? "🌐 " : ""}${escapeHtml(a.label)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(2, a.dur / bMax * 100)}%;background:${col}"></div></div>
          <span class="hbar-val">${fmtDur(a.dur)}</span>
        </div>`;
    }).join("");
    browserCard = `
      <div class="card">
        <h2>${t("inBrowser")} <span class="h2-right">${fmtDur(bagg.total)} ${t("total")}</span></h2>
        <div class="browser-split">
          <div class="donut-wrap">
            ${donutSVG(bagg.catTotals, bagg.total, 128, 15)}
            <div class="donut-center"><div class="dc-time" style="font-size:14px">${fmtDur(bagg.total)}</div><div class="dc-label">Browser</div></div>
          </div>
          <div class="browser-cats">${bCatOrder.map(c => catRowHTML(c, bagg.catTotals[c], bagg.total)).join("")}</div>
        </div>
        <div class="apps-heading" style="margin-top:16px">${t("topSites")}</div>
        <div class="browser-sites">${siteRows}</div>
      </div>`;
  }

  view.innerHTML = selector + `
    <div class="sv-grid">
      <div>
        <div class="card">
          <h2>${chartTitle} ${chartHint}</h2>
          ${barChart(buckets, clickable)}
        </div>
        <div class="card">
          <h2>${topTitle}
            <span class="h2-right">
              <select class="sort-select" id="appSortSel">
                <option value="dur" ${byBursts ? "" : "selected"}>${t("byDuration")}</option>
                <option value="bursts" ${byBursts ? "selected" : ""}>${t("byFrequency")}</option>
              </select>
            </span>
          </h2>
          ${appBars}
        </div>
        ${browserCard}
        <div class="card">
          <h2>${t("categoriesDetail")}</h2>
          ${catDetails}
        </div>
      </div>
      <div>
        <div class="card">
          <h2>${t("distribution")}</h2>
          <div class="donut-wrap">
            ${donutSVG(agg.catTotals, agg.total)}
            <div class="donut-center">
              <div class="dc-time">${fmtDur(agg.total)}</div>
              <div class="dc-label">${donutLabel}</div>
            </div>
          </div>
          <div class="cat-rows">${catOrder.map(c => catRowHTML(c, agg.catTotals[c], agg.total)).join("")}</div>
          <p class="stats-note">${summary}</p>
        </div>
      </div>
    </div>`;

  wire();
}

async function setPeriod(p) {
  state.statsPeriod = p;
  saveJSON("zeitblick.statsPeriod", p);
  if (p === "woche") state.weekStart = mondayOf(currentAnchor());
  await loadContext();
  render();
}

/* ── Legende links ── */

function renderLegend() {
  const days = weekDays();
  const totals = {};
  for (const d of days)
    for (const s of (state.days[isoDate(d)] || []))
      totals[s.cat] = (totals[s.cat] || 0) + s.dur;

  const ul = $("#legend");
  ul.innerHTML = "";
  for (const [key, c] of Object.entries(CATEGORIES)) {
    const li = document.createElement("li");
    if (state.hiddenCats.has(key)) li.className = "hidden-cat";
    li.innerHTML = `
      <span class="legend-dot" style="background:${c.color}"></span>
      <span class="legend-name">${catName(key)}</span>
      <span class="legend-time">${totals[key] ? fmtDur(totals[key]) : ""}</span>`;
    li.addEventListener("click", () => {
      state.hiddenCats.has(key) ? state.hiddenCats.delete(key) : state.hiddenCats.add(key);
      saveJSON("zeitblick.hiddenCats", [...state.hiddenCats]);
      render();
    });
    ul.appendChild(li);
  }
}

/* ── Tracker-Status ── */

function renderStatus() {
  const el = $("#trackerStatus");
  const gen = state.generated[isoDate(new Date())];
  const live = gen && (Date.now() - gen.getTime()) < 90000;
  el.querySelector(".status-dot").className = "status-dot" + (live ? "" : " off");
  el.querySelector(".status-text").textContent = live ? t("trackerLive") : t("trackerOff");
}

/* ── Tooltip ── */

const tooltip = document.getElementById("tooltip");

function attachTooltip(el, b) {
  el.addEventListener("mouseenter", () => {
    const c = CATEGORIES[b.cat];
    const head = (b.web ? "🌐 " : "") + escapeHtml(b.label || appName(b.app));
    const via = b.web ? `<div class="tt-title">in ${escapeHtml(appName(b.app))}</div>` : "";
    tooltip.innerHTML = `
      <div class="tt-app">${head}</div>
      ${b.title ? `<div class="tt-title">${escapeHtml(b.title)}</div>` : ""}
      ${via}
      <div class="tt-line"><span class="legend-dot" style="background:${c.color}"></span>${catName(b.cat)}</div>
      <div class="tt-line">${fmtClock(b.start)} – ${fmtClock(b.end)}${t("uhr") ? " " + t("uhr") : ""} · <b>${fmtDur(b.active || b.dur)}</b></div>`;
    tooltip.hidden = false;
  });
  el.addEventListener("mousemove", e => {
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = tooltip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  });
  el.addEventListener("mouseleave", () => { tooltip.hidden = true; });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ═══════════════ Navigation & Start ═══════════════ */

/* Zeitraum-bewusstes Vor-/Zurückblättern: Tag bzw. Monat in der Statistik, sonst Woche */
function navigate(dir) {
  if (state.view === "statistik" && state.statsPeriod === "tag") {
    state.selectedDay = isoDate(addDays(currentAnchor(), dir));
    state.weekStart = mondayOf(currentAnchor());
  } else if (state.view === "statistik" && state.statsPeriod === "monat") {
    const d = currentAnchor();
    state.selectedDay = isoDate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    state.weekStart = mondayOf(currentAnchor());
  } else {
    state.weekStart = addDays(state.weekStart, dir * 7);
    const days = weekDays().map(isoDate);
    if (!days.includes(state.selectedDay)) {
      const todayIso = isoDate(new Date());
      state.selectedDay = days.includes(todayIso) ? todayIso : days[0];
    }
  }
  loadContext();
}

$("#prevWeek").addEventListener("click", () => navigate(-1));
$("#nextWeek").addEventListener("click", () => navigate(1));
$("#zoomIn").addEventListener("click", () => zoom(ZOOM_STEP));
$("#zoomOut").addEventListener("click", () => zoom(-ZOOM_STEP));
$("#viewCal").addEventListener("click", () => setView("kalender"));
$("#viewStats").addEventListener("click", () => setView("statistik"));
$("#todayBtn").addEventListener("click", () => {
  state.weekStart = mondayOf(new Date());
  state.selectedDay = isoDate(new Date());
  loadContext();
});

function applyDetail() {
  $("#det1").classList.toggle("active", state.detail === "min1");
  $("#det2").classList.toggle("active", state.detail === "min2");
  $("#detGenau").classList.toggle("active", state.detail === "genau");
}
function setDetail(mode) {
  state.detail = mode;
  saveJSON("zeitblick.detail", mode);
  applyDetail();
  render();
}
$("#det1").addEventListener("click", () => setDetail("min1"));
$("#det2").addEventListener("click", () => setDetail("min2"));
$("#detGenau").addEventListener("click", () => setDetail("genau"));

function applyColorMode() {
  $("#colCat").classList.toggle("active", state.colorMode !== "app");
  $("#colApp").classList.toggle("active", state.colorMode === "app");
}
function setColorMode(mode) {
  state.colorMode = mode;
  saveJSON("zeitblick.colorMode", mode);
  applyColorMode();
  render();
}
$("#colCat").addEventListener("click", () => setColorMode("kategorie"));
$("#colApp").addEventListener("click", () => setColorMode("app"));

/* ═══════════════ Sprache (DE/EN) ═══════════════ */

function applyStaticI18n() {
  document.documentElement.lang = state.lang;
  document.title = state.lang === "en" ? "Zeitblick – Activity Tracker" : "Zeitblick – Aktivitäts-Tracker";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const val = t(el.dataset.i18n);
    if (val === undefined) return;
    if (/<[a-z][\s\S]*>/i.test(val)) el.innerHTML = val; else el.textContent = val;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const val = t(el.dataset.i18nPh);
    if (val !== undefined) el.placeholder = val;
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const val = t(el.dataset.i18nTitle);
    if (val !== undefined) el.title = val;
  });
  $("#langDe").classList.toggle("active", state.lang !== "en");
  $("#langEn").classList.toggle("active", state.lang === "en");
  document.querySelectorAll("#focusDurations .fchip").forEach(b => {
    b.textContent = `${b.dataset.min} ${t("min")}`;
  });
}
function setLang(lang) {
  state.lang = lang;
  saveJSON("zeitblick.lang", lang);
  applyStaticI18n();
  render();
  renderFocus();
}
$("#langDe").addEventListener("click", () => setLang("de"));
$("#langEn").addEventListener("click", () => setLang("en"));
applyStaticI18n();

/* ═══════════════ Seitenleisten-Umschalter: Ansicht / Fokus-Modus ═══════════════ */

function applySidebarTab() {
  const tab = loadJSON("zeitblick.sidebarTab", "ansicht");
  const fokus = tab === "fokus";
  $("#sidebarAnsicht").hidden = fokus;
  $("#sidebarFokus").hidden = !fokus;
  $("#tabAnsicht").classList.toggle("active", !fokus);
  $("#tabFokus").classList.toggle("active", fokus);
}
function setSidebarTab(tab) {
  saveJSON("zeitblick.sidebarTab", tab);
  applySidebarTab();
}
$("#tabAnsicht").addEventListener("click", () => setSidebarTab("ansicht"));
$("#tabFokus").addEventListener("click", () => {
  setSidebarTab("fokus");
  saveJSON("zeitblick.fokusTabSeen", true);
  $("#fokusTabHint").hidden = true;
});
applySidebarTab();
// Roter Punkt am Fokus-Modus-Tab, bis er das erste Mal angeklickt wurde -
// sonst finden neue Nutzer den Fokus-Modus u.U. nie (sitzt hinter dem Tab).
if (loadJSON("zeitblick.fokusTabSeen", false)) {
  $("#fokusTabHint").hidden = true;
}

/* ═══════════════ Fokus-Modus & Tagesziel ═══════════════ */

let selectedFocusDuration = 25;
let focusState = null;
let goalInputFocused = false; // Eingabefeld nicht ueberschreiben, waehrend getippt wird

async function apiFocusGet() {
  try {
    const res = await fetch(`/api/focus?t=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function apiFocusPost(path, body) {
  try {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  } catch { /* Tracker laeuft evtl. gerade nicht - Dashboard bleibt trotzdem nutzbar */ }
}

function fmtCountdown(totalSec) {
  totalSec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(totalSec / 60), s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderFocus() {
  if (!focusState) return;
  const st = focusState;

  $("#focusIdle").hidden = !!st.active;
  $("#focusActive").hidden = !st.active;

  document.querySelectorAll("#focusDurations .fchip").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.min) === selectedFocusDuration);
  });

  if (st.active) {
    $("#focusModeLabel").textContent = st.mode === "break" ? t("breakRunning") : t("focusRunning");
    $("#focusTimeLeft").textContent = fmtCountdown(st.remaining_seconds ?? 0);
  }

  $("#focusNotifToggle").checked = st.notifications !== false;
  $("#focusBlockToggle").checked = st.blocking !== false;
  $("#focusBlockedWrap").hidden = st.blocking === false;

  const chipsWrap = $("#focusBlockedChips");
  chipsWrap.innerHTML = (st.blocked || []).map(kw => `
    <span class="fchip blocked-chip" data-kw="${escapeHtml(kw)}">${escapeHtml(kw)}<span class="focus-chip-x">✕</span></span>
  `).join("") || `<span class="side-hint">${t("noKeywordsYet")}</span>`;
  chipsWrap.querySelectorAll(".focus-chip-x").forEach(x => {
    x.addEventListener("click", () => {
      const kw = x.parentElement.dataset.kw;
      const next = (focusState.blocked || []).filter(k => k !== kw);
      apiFocusPost("/api/focus/settings", { blocked: next }).then(refreshFocus);
    });
  });

  const goalHours = st.daily_goal_hours || 6;
  if (!goalInputFocused) $("#goalHoursInput").value = goalHours;
  const pct = st.goal_pct ?? 0;
  $("#goalBarFill").style.width = Math.min(100, pct) + "%";
  $("#goalLine").textContent = tf("goalLine", fmtDur(st.today_seconds || 0), goalHours, pct);
}

async function refreshFocus() {
  focusState = await apiFocusGet();
  if (focusState) renderFocus();
}

document.querySelectorAll("#focusDurations .fchip").forEach(b => {
  b.addEventListener("click", () => {
    selectedFocusDuration = Number(b.dataset.min);
    renderFocus();
  });
});

$("#focusStartBtn").addEventListener("click", async () => {
  await apiFocusPost("/api/focus/start", { duration_min: selectedFocusDuration });
  refreshFocus();
});
$("#focusStopBtn").addEventListener("click", async () => {
  await apiFocusPost("/api/focus/stop");
  refreshFocus();
});
$("#focusNotifToggle").addEventListener("change", async e => {
  await apiFocusPost("/api/focus/settings", { notifications: e.target.checked });
  refreshFocus();
});
$("#focusBlockToggle").addEventListener("change", async e => {
  await apiFocusPost("/api/focus/settings", { blocking: e.target.checked });
  refreshFocus();
});
$("#focusAddBtn").addEventListener("click", addFocusKeyword);
$("#focusAddInput").addEventListener("keydown", e => { if (e.key === "Enter") addFocusKeyword(); });
async function addFocusKeyword() {
  const input = $("#focusAddInput");
  const kw = input.value.trim().toLowerCase();
  if (!kw || !focusState) return;
  const next = [...new Set([...(focusState.blocked || []), kw])];
  input.value = "";
  await apiFocusPost("/api/focus/settings", { blocked: next });
  refreshFocus();
}
$("#goalHoursInput").addEventListener("focus", () => { goalInputFocused = true; });
$("#goalHoursInput").addEventListener("blur", async e => {
  goalInputFocused = false;
  const val = parseFloat(e.target.value);
  if (val > 0) await apiFocusPost("/api/focus/settings", { daily_goal_hours: val });
  refreshFocus();
});

refreshFocus();
setInterval(refreshFocus, 3000);

/* Erststart */
applyHourHeight();
applyColorMode();
applyDetail();
applyView();
loadWeek().then(() => { if (state.view !== "statistik") autoScroll(); });

/* Auto-Refresh + Jetzt-Linie */
setInterval(refreshToday, REFRESH_MS);
setInterval(() => { if (state.view !== "statistik") renderCalendar(); }, 60000);
