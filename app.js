/* ═══════════════ Zeitblick – Dashboard-Logik ═══════════════ */
"use strict";

const ZOOM_MIN = 48, ZOOM_MAX = 192, ZOOM_STEP = 24, ZOOM_DEFAULT = 96; // px pro Stunde
const BURST_GAP = 300;           // Sek. Pause, ab der eine neue "Nutzung" zählt
const MERGE_GAP = 90;            // Sek. – benachbarte gleiche Blöcke verschmelzen
const ABSORB_MAX = 60;           // "Zusammengefasst": kürzere Wechsel (< 1 Min.) werden geschluckt
const DETAIL_MIN = 5;            // "Genau": alles ab so vielen Sek. anzeigen
const REFRESH_MS = 30000;        // Auto-Aktualisierung

/* ── Kategorien (Farben + Namen) ── */
const CATEGORIES = {
  produktiv:      { name: "Produktivität",   color: "#4d7cfe" },
  design:         { name: "Design & Kreativ", color: "#8b5cf6" },
  lernen:         { name: "Lernen",          color: "#06b6d4" },
  kommunikation:  { name: "Kommunikation",   color: "#22c55e" },
  soziale_medien: { name: "Soziale Medien",  color: "#ec4899" },
  browsing:       { name: "Browsing",        color: "#f59e0b" },
  gaming:         { name: "Gaming",          color: "#ef4444" },
  unterhaltung:   { name: "Unterhaltung",    color: "#a855f7" },
  windows:        { name: "Windows",         color: "#7891ab" },
  system:         { name: "Sonstiges",       color: "#565b6b" },
};

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
  detail: loadJSON("zeitblick.detail", "grob"),   // "grob" (zusammengefasst) | "genau"
  hourH: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, loadJSON("zeitblick.hourH", ZOOM_DEFAULT))),
  view: loadJSON("zeitblick.view", "kalender"),   // "kalender" | "statistik"
  statsPeriod: loadJSON("zeitblick.statsPeriod", "woche"), // "tag" | "woche" | "monat"
  appSort: loadJSON("zeitblick.appSort", "dur"),  // "dur" | "bursts"
  colorMode: loadJSON("zeitblick.colorMode", "kategorie"), // "kategorie" | "app"
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
    return currentAnchor().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  if (state.view === "statistik" && state.statsPeriod === "monat")
    return currentAnchor().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const a = weekDays()[0], b = weekDays()[6], o = { day: "numeric", month: "short" };
  return `${a.toLocaleDateString("de-DE", o)} – ${b.toLocaleDateString("de-DE", { ...o, year: "numeric" })}`;
}

function fmtDur(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} Sek.`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m} Min.`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}
function fmtClock(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtShort(sec) {
  if (sec >= 3600) return (sec / 3600).toFixed(1).replace(".", ",") + " h";
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
      <span class="cr-name">${CATEGORIES[cat].name}</span>
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
    // 2) "Zusammengefasst": kurzer Weg-Klick (< ABSORB_MAX) → in laufenden Block schlucken
    if (grob && last && s.dur < ABSORB_MAX && gap <= mergeGap) {
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
  const wort = state.view === "statistik"
    ? (state.statsPeriod === "tag" ? "Tag" : state.statsPeriod === "monat" ? "Monat" : "Woche")
    : "Woche";
  $("#weekTotal").innerHTML = total > 0
    ? `${wort} gesamt: <b>${fmtDur(total)}</b>` : "Noch keine Daten in diesem Zeitraum";
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
      <div class="dh-name">${d.toLocaleDateString("de-DE", { weekday: "short" })}</div>
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
  const dateLabel = day.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  if (!sessions.length) {
    panel.innerHTML = `
      <div class="stats-date">${dateLabel}</div>
      <div class="stats-sub">Keine Aktivität aufgezeichnet.</div>
      <p class="stats-note">Sobald der Tracker läuft (<code>start-tracker.cmd</code>),
      erscheinen hier automatisch deine Aktivitäten.</p>`;
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
    const options = Object.entries(CATEGORIES).map(([ck, c]) =>
      `<option value="${ck}" ${ck === cur ? "selected" : ""}>${c.name}</option>`
    ).join("");
    const right = `<select class="app-cat-select" data-key="${escapeHtml(ovKey)}" title="Kategorie ändern">${options}</select>`;
    const neu = (!a.web && !isKnown(a.app)) ? `<span class="badge-new" title="Wird bei der nächsten automatischen Prüfung von Claude kategorisiert">NEU</span>` : "";
    return `
      <div class="app-row">
        <span class="app-dot" style="background:${activityColor(a)}"></span>
        <div class="app-info">
          <div class="app-name" title="${escapeHtml(a.label)}">${icon}${escapeHtml(a.label)}${neu}</div>
          <div class="app-meta">${fmtDur(a.dur)} · ${a.bursts}× benutzt</div>
        </div>
        ${right}
      </div>`;
  }).join("");

  const webCount = Object.values(apps).filter(a => a.web).length;
  panel.innerHTML = `
    <div class="stats-date">${dateLabel}</div>
    <div class="stats-sub">${sessions.length} Aktivitäten · ${Object.keys(apps).length} Einträge${webCount ? ` (davon ${webCount} Websites)` : ""}</div>
    <div class="donut-wrap">
      ${donutSVG(catTotals, total)}
      <div class="donut-center">
        <div class="dc-time">${fmtDur(total)}</div>
        <div class="dc-label">getrackt</div>
      </div>
    </div>
    <div class="cat-rows">${catRows}</div>
    <div class="apps-heading">Top-Programme &amp; Websites</div>
    <div class="app-list">${appRows}</div>
    <p class="stats-note">🌐 = Website (im Browser erkannt). Jedes Programm <b>und
    jede Website</b> lässt sich über das Dropdown in eine Kategorie einsortieren –
    wird lokal gespeichert und sofort überall angewendet.</p>`;

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
        fill="${CATEGORIES[key].color}" opacity="0.92"><title>${CATEGORIES[key].name}: ${fmtDur(sec)}</title></rect>`;
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
        <title>${b.date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}: ${b.total ? fmtDur(b.total) : "keine Daten"}</title></rect>`;
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
      <button class="pseg ${period === "tag" ? "active" : ""}" data-period="tag">Tag</button>
      <button class="pseg ${period === "woche" ? "active" : ""}" data-period="woche">Woche</button>
      <button class="pseg ${period === "monat" ? "active" : ""}" data-period="monat">Monat</button>
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
    view.innerHTML = selector + `<div class="stats-empty">Keine Daten in diesem Zeitraum – sobald der
      Tracker läuft, erscheinen hier Diagramme und Auswertungen.</div>`;
    wire(); return;
  }

  // Balkendiagramm-Eimer je nach Zeitraum
  let buckets, clickable = false, chartTitle;
  if (period === "tag") {
    chartTitle = "Aktivität pro Stunde";
    buckets = hourlyBuckets(allSessions).map((h, i) => ({
      label: i % 3 === 0 ? String(i).padStart(2, "0") : "", total: h.total, catTotals: h.catTotals,
    }));
  } else {
    clickable = true;
    chartTitle = period === "monat" ? "Aktivität pro Tag im Monat" : "Aktivität pro Tag";
    buckets = days.map(d => {
      const a = aggregate(state.days[isoDate(d)] || []);
      return {
        label: period === "monat" ? String(d.getDate()) : d.toLocaleDateString("de-DE", { weekday: "short" }),
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
          ${CATEGORIES[c].name}
          <span class="catd-time">${fmtDur(catSec)} · ${Math.round(catSec / agg.total * 100)} %</span>
        </div>
        ${rows}
      </div>`;
  }).join("");

  const donutLabel = period === "tag" ? "Tag" : period === "monat" ? "Monat" : "Woche";
  const topTitle = period === "tag" ? "Top-Programme &amp; Websites am Tag"
    : period === "monat" ? "Top-Programme &amp; Websites im Monat" : "Top-Programme &amp; Websites der Woche";
  const chartHint = clickable ? `<span class="h2-right">Balken anklicken für den Tag →</span>` : "";

  // Zusammenfassungszeile
  let summary;
  if (period === "tag") {
    summary = `${allSessions.length} Aktivitäten · ${Object.keys(agg.apps).length} Programme &amp; Websites`;
  } else {
    const activeDays = days.filter(d => (state.days[isoDate(d)] || []).length > 0).length;
    summary = `${activeDays} von ${days.length} Tagen aktiv · Ø ${fmtDur(agg.total / Math.max(1, activeDays))} pro aktivem Tag · ${Object.keys(agg.apps).length} Programme &amp; Websites`;
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
        <h2>Im Browser – wofür du den Browser nutzt <span class="h2-right">${fmtDur(bagg.total)} gesamt</span></h2>
        <div class="browser-split">
          <div class="donut-wrap">
            ${donutSVG(bagg.catTotals, bagg.total, 128, 15)}
            <div class="donut-center"><div class="dc-time" style="font-size:14px">${fmtDur(bagg.total)}</div><div class="dc-label">Browser</div></div>
          </div>
          <div class="browser-cats">${bCatOrder.map(c => catRowHTML(c, bagg.catTotals[c], bagg.total)).join("")}</div>
        </div>
        <div class="apps-heading" style="margin-top:16px">Meistbesuchte Websites &amp; Seiten</div>
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
                <option value="dur" ${byBursts ? "" : "selected"}>nach Dauer</option>
                <option value="bursts" ${byBursts ? "selected" : ""}>nach Häufigkeit</option>
              </select>
            </span>
          </h2>
          ${appBars}
        </div>
        ${browserCard}
        <div class="card">
          <h2>Kategorien im Detail – welche Programme &amp; Websites stecken dahinter</h2>
          ${catDetails}
        </div>
      </div>
      <div>
        <div class="card">
          <h2>Verteilung</h2>
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
      <span class="legend-name">${c.name}</span>
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
  el.querySelector(".status-text").textContent = live
    ? "Tracker läuft – Daten sind live"
    : "Tracker ist nicht aktiv";
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
      <div class="tt-line"><span class="legend-dot" style="background:${c.color}"></span>${c.name}</div>
      <div class="tt-line">${fmtClock(b.start)} – ${fmtClock(b.end)} Uhr · <b>${fmtDur(b.active || b.dur)}</b></div>`;
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
  $("#detGrob").classList.toggle("active", state.detail !== "genau");
  $("#detGenau").classList.toggle("active", state.detail === "genau");
}
function setDetail(mode) {
  state.detail = mode;
  saveJSON("zeitblick.detail", mode);
  applyDetail();
  render();
}
$("#detGrob").addEventListener("click", () => setDetail("grob"));
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

/* Erststart */
applyHourHeight();
applyColorMode();
applyDetail();
applyView();
loadWeek().then(() => { if (state.view !== "statistik") autoScroll(); });

/* Auto-Refresh + Jetzt-Linie */
setInterval(refreshToday, REFRESH_MS);
setInterval(() => { if (state.view !== "statistik") renderCalendar(); }, 60000);
