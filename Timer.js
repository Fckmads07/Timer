/* =====================================================================
   Timer by Madhav — Clock · Stopwatch · Countdown · Pomodoro
   ===================================================================== */
"use strict";

/* ---------------- Helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const pad = (n, len = 2) => String(Math.floor(n)).padStart(len, "0");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RING_C = 2 * Math.PI * 100; // circumference of the r=100 rings

/** Formats milliseconds as [hh:]mm:ss[.cc] */
function fmt(ms, { cs = false, forceH = false } = {}) {
  ms = Math.max(0, ms);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  let out = (h || forceH ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
  if (cs) out += "." + pad((ms % 1000) / 10);
  return out;
}
/** Countdown display: round UP so "5:00" shows right away and "0:00" only at the end */
const fmtDown = (ms, forceH) => fmt(Math.ceil(ms / 1000) * 1000, { forceH });

function setRing(el, progress) {
  el.style.strokeDasharray = RING_C;
  el.style.strokeDashoffset = RING_C * (1 - clamp(progress, 0, 1));
}

/* ---------------- Storage (safe) ---------------- */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const settings = Object.assign(
  { bg: "network", accent: "#00e0ff", h24: false, sound: true, lang: "en-CA",
    autoStart: true, work: 25, short: 5, long: 15 },
  store.get("timer.settings", {})
);
const saveSettings = () => store.set("timer.settings", settings);

/* ---------------- Sound (Web Audio, no files needed) ---------------- */
let audioCtx = null;
function beep(freq = 880, dur = 0.18, delay = 0, vol = 0.22) {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* audio not available */ }
}
const chime = () => { beep(880, 0.2); beep(1175, 0.2, 0.22); beep(1568, 0.4, 0.44); };
const click = () => beep(1400, 0.05, 0, 0.08);

/* ---------------- Toast + Alarm + Notifications ---------------- */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function askNotify() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    try { new Notification(title, { body, icon: "./f813828474e1252f9784d7bb17917079.jpg" }); } catch {}
  }
}

let alarmLoop = null, alarmStop = null;
function showAlarm(title, msg) {
  $("#alarm-title").textContent = title;
  $("#alarm-msg").textContent = msg;
  $("#alarm").classList.add("show");
  chime();
  clearInterval(alarmLoop);
  clearTimeout(alarmStop);
  alarmLoop = setInterval(chime, 1600);
  alarmStop = setTimeout(() => clearInterval(alarmLoop), 30000); // stop ringing after 30 s
  notify(title, msg);
  $("#alarm-ok").focus();
}
function hideAlarm() {
  clearInterval(alarmLoop);
  clearTimeout(alarmStop);
  $("#alarm").classList.remove("show");
}

/* =====================================================================
   TABS
   ===================================================================== */
const VIEWS = ["clock", "stopwatch", "timer", "pomodoro"];
// Open the tab from the URL (e.g. Timer.html#pomodoro), else the last one used
const hashView = location.hash.slice(1);
let currentView = VIEWS.includes(hashView) ? hashView
  : VIEWS.includes(store.get("timer.view")) ? store.get("timer.view") : "clock";

function moveIndicator() {
  const active = $(".tab.active");
  const ind = $(".tab-indicator");
  ind.style.width = active.offsetWidth + "px";
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
  ind.style.background = currentView === "pomodoro" ? getComputedStyle($("#view-pomodoro")).getPropertyValue("--accent") : "";
}

function showView(view) {
  currentView = view;
  store.set("timer.view", view);
  history.replaceState(null, "", "#" + view);
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-" + view));
  moveIndicator();
}
$$(".tab").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
addEventListener("resize", moveIndicator);
addEventListener("hashchange", () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== currentView) showView(v); });

/* =====================================================================
   CLOCK
   ===================================================================== */
const elH = $("#hours"), elM = $("#minutes"), elS = $("#seconds");
const handH = $("#hand-h"), handM = $("#hand-m"), handS = $("#hand-s"), secRing = $("#sec-ring");
const SEC_RING_C = 2 * Math.PI * 96;

/** Build the 60 ticks + 12 numbers of the analog clock */
(function buildAnalog() {
  let html = "";
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    html += `<line class="tick${major ? " major" : ""}" x1="100" y1="${major ? 11 : 12}" x2="100" y2="${major ? 21 : 16}" transform="rotate(${i * 6} 100 100)"/>`;
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30 - 90) * (Math.PI / 180);
    html += `<text x="${(100 + Math.cos(a) * 68).toFixed(2)}" y="${(100 + Math.sin(a) * 68).toFixed(2)}">${n}</text>`;
  }
  $("#ticks").innerHTML = html;
  secRing.style.strokeDasharray = SEC_RING_C;
})();

/** Updates text only when it changes, and replays the "pop" animation */
function setDigits(el, value) {
  if (el.textContent === value) return;
  el.textContent = value;
  el.classList.remove("pop");
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add("pop");
}

const CITIES = [
  ["New York", "America/New_York"],
  ["London", "Europe/London"],
  ["Paris", "Europe/Paris"],
  ["Mumbai", "Asia/Kolkata"],
  ["Tokyo", "Asia/Tokyo"],
  ["Sydney", "Australia/Sydney"],
];
let cityFormatters = [];

function buildWorld() {
  cityFormatters = CITIES.map(([, tz]) => ({
    time: new Intl.DateTimeFormat(settings.lang, { hour: "2-digit", minute: "2-digit", hour12: !settings.h24, timeZone: tz }),
    parts: new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone: tz }),
  }));
  $("#world").innerHTML = CITIES.map(([name]) =>
    `<div class="city"><div class="name"><span>${name}</span><span class="icon"></span></div><div class="time mono">--:--</div><div class="diff"></div></div>`
  ).join("");
}

/** Returns {h, dayOffsetMinutes} for a timezone, relative to local time */
function zoneInfo(fmtParts, now) {
  const p = Object.fromEntries(fmtParts.formatToParts(now).map((x) => [x.type, x.value]));
  const zoned = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute);
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  return { hour: +p.hour, diffMin: Math.round((zoned - local) / 60000), day: +p.day };
}

function updateWorld(now) {
  const cards = $$("#world .city");
  cityFormatters.forEach((f, i) => {
    const card = cards[i];
    const info = zoneInfo(f.parts, now);
    // Show "a.m./PM" as a small suffix so the time stays on one line
    const parts = f.time.formatToParts(now);
    const period = parts.filter((x) => x.type === "dayPeriod").map((x) => x.value).join("");
    const clock = parts.filter((x) => x.type !== "dayPeriod").map((x) => x.value).join("").trim();
    card.querySelector(".time").innerHTML = clock + (period ? ` <small>${period}</small>` : "");
    card.querySelector(".icon").textContent = info.hour >= 6 && info.hour < 19 ? "☀" : "☾";

    const h = info.diffMin / 60;
    const label = h === 0 ? "Same time" : `${h > 0 ? "+" : "−"}${Math.abs(h)}h`;
    const dayDiff = info.day !== now.getDate() ? (info.diffMin > 0 ? " · Tomorrow" : " · Yesterday") : " · Today";
    card.querySelector(".diff").textContent = label + dayDiff;
  });
}

let lastDateStr = "", lastWorldSec = -1;
function updateClock(now) {
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();

  // Digital
  setDigits(elH, pad(settings.h24 ? h : h % 12 || 12));
  setDigits(elM, pad(m));
  setDigits(elS, pad(s));
  $("#ampm").textContent = settings.h24 ? "" : h >= 12 ? "PM" : "AM";

  // Analog (smooth hands)
  const sec = s + ms / 1000;
  const min = m + sec / 60;
  const hr = (h % 12) + min / 60;
  handS.setAttribute("transform", `rotate(${sec * 6} 100 100)`);
  handM.setAttribute("transform", `rotate(${min * 6} 100 100)`);
  handH.setAttribute("transform", `rotate(${hr * 30} 100 100)`);
  secRing.style.strokeDashoffset = SEC_RING_C * (1 - sec / 60);

  // Once per second: date, greeting, day progress, world clocks
  if (s === lastWorldSec) return;
  lastWorldSec = s;

  const dateStr = now.toLocaleDateString(settings.lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  if (dateStr !== lastDateStr) { $("#date").textContent = dateStr; lastDateStr = dateStr; }

  const fr = settings.lang.startsWith("fr");
  const greet = h < 5 ? (fr ? "Bonne nuit" : "Good night")
    : h < 12 ? (fr ? "Bonjour" : "Good morning")
    : h < 18 ? (fr ? "Bon après-midi" : "Good afternoon")
    : (fr ? "Bonsoir" : "Good evening");
  $("#greeting").textContent = `${greet}, Madhav`;

  const pct = ((h * 3600 + m * 60 + s) / 86400) * 100;
  $("#day-bar").style.width = pct.toFixed(2) + "%";
  $("#day-pct").textContent = pct.toFixed(1) + "%";

  updateWorld(now);
}

/* =====================================================================
   STOPWATCH
   ===================================================================== */
const sw = { running: false, startedAt: 0, elapsed: 0, laps: [] };
const swNow = () => sw.elapsed + (sw.running ? performance.now() - sw.startedAt : 0);
const lapsTotal = () => sw.laps.reduce((a, b) => a + b, 0);

function swToggle() {
  if (sw.running) {
    sw.elapsed = swNow();
    sw.running = false;
  } else {
    sw.startedAt = performance.now();
    sw.running = true;
  }
  click();
  swButtons();
  renderStopwatch();
}
function swLap() {
  if (!sw.running) return;
  sw.laps.push(swNow() - lapsTotal());
  click();
  renderLaps();
}
function swReset() {
  sw.running = false;
  sw.elapsed = 0;
  sw.laps = [];
  renderLaps();
  swButtons();
  renderStopwatch();
}
function swButtons() {
  const start = $("#sw-start");
  start.textContent = sw.running ? "Stop" : sw.elapsed ? "Resume" : "Start";
  start.classList.toggle("running", sw.running);
  $("#sw-lap").disabled = !sw.running;
  $("#sw-reset").disabled = !sw.running && sw.elapsed === 0;
}
function renderLaps() {
  const laps = sw.laps;
  const min = Math.min(...laps), max = Math.max(...laps);
  let total = 0;
  const rows = laps.map((lap, i) => {
    total += lap;
    const cls = laps.length >= 3 ? (lap === min ? "best" : lap === max ? "worst" : "") : "";
    const width = (lap / max) * 100;
    return `<li class="${cls}"><span>Lap ${i + 1}</span><span class="mono">${fmt(lap, { cs: true })}</span><span class="mono">${fmt(total, { cs: true })}</span><i class="lap-bar" style="width:${width}%"></i></li>`;
  });
  $("#sw-laps").innerHTML = rows.reverse().join("");
}
function renderStopwatch() {
  const t = swNow();
  $("#sw-time").textContent = fmt(t, { cs: true });
  $("#sw-lap-time").textContent = `Lap ${sw.laps.length + 1} · ${fmt(t - lapsTotal(), { cs: true })}`;
  setRing($("#sw-ring"), (t % 60000) / 60000); // one full turn per minute
}
$("#sw-start").addEventListener("click", swToggle);
$("#sw-lap").addEventListener("click", swLap);
$("#sw-reset").addEventListener("click", swReset);

/* =====================================================================
   COUNTDOWN TIMER
   ===================================================================== */
const tm = { state: "idle", duration: 300000, remaining: 300000, endAt: 0 }; // idle | running | paused | done
const tmIn = { h: $("#tm-h"), m: $("#tm-m"), s: $("#tm-s") };
const TM_MAX = { h: 99, m: 59, s: 59 };

function readInputs() {
  const v = (k) => clamp(parseInt(tmIn[k].value, 10) || 0, 0, TM_MAX[k]);
  return (v("h") * 3600 + v("m") * 60 + v("s")) * 1000;
}
function writeInputs(ms) {
  const total = Math.round(ms / 1000);
  tmIn.h.value = clamp(Math.floor(total / 3600), 0, 99);
  tmIn.m.value = Math.floor((total % 3600) / 60);
  tmIn.s.value = total % 60;
}
function tmRemaining() {
  return tm.state === "running" ? Math.max(0, tm.endAt - Date.now()) : tm.remaining;
}

function tmStart() {
  if (tm.state === "running") { // pause
    tm.remaining = tmRemaining();
    tm.state = "paused";
  } else {
    if (tm.state === "idle" || tm.state === "done") {
      tm.duration = readInputs();
      tm.remaining = tm.duration;
      if (tm.duration <= 0) { toast("Set a time first ⏳"); return; }
    }
    tm.endAt = Date.now() + tm.remaining;
    tm.state = "running";
    askNotify();
  }
  click();
  tmUI();
}
function tmReset() {
  tm.state = "idle";
  tm.duration = readInputs();
  tm.remaining = tm.duration;
  tmUI();
}
function tmSet(ms) {
  writeInputs(ms);
  tm.state = "idle";
  tm.duration = tm.remaining = readInputs();
  tmUI();
}
function tmAdd(ms) {
  if (tm.state === "running" || tm.state === "paused") {
    tm.endAt += ms;
    tm.remaining += ms;
    tm.duration += ms;
    toast("+1 minute added");
  } else {
    tmSet(readInputs() + ms);
  }
  tmUI();
}
function tmCheck() {
  if (tm.state !== "running" || Date.now() < tm.endAt) return;
  tm.state = "done";
  tm.remaining = 0;
  tmUI();
  showAlarm("Time's up!", `Your ${fmt(tm.duration, { forceH: tm.duration >= 3600000 })} timer has finished.`);
}
function tmUI() {
  const editing = tm.state === "idle";
  $("#tm-inputs").classList.toggle("hidden", !editing);
  $("#tm-time").classList.toggle("hidden", editing);

  const start = $("#tm-start");
  start.textContent = tm.state === "running" ? "Pause" : tm.state === "paused" ? "Resume" : "Start";
  start.classList.toggle("running", tm.state === "running");
  $("#tm-reset").disabled = tm.state === "idle";

  const end = $("#tm-end");
  if (tm.state === "running") {
    end.textContent = "Ends at " + new Date(tm.endAt).toLocaleTimeString(settings.lang, { hour: "2-digit", minute: "2-digit", hour12: !settings.h24 });
  } else if (tm.state === "paused") end.textContent = "Paused";
  else if (tm.state === "done") end.textContent = "Finished ✔";
  else end.textContent = "Scroll or type to set";

  $("#view-timer .ring-wrap").classList.toggle("done", tm.state === "done");
  renderTimer();
}
function renderTimer() {
  const rem = tmRemaining();
  const ring = $("#tm-ring");
  if (tm.state === "idle") {
    setRing(ring, 1);
  } else {
    $("#tm-time").textContent = fmtDown(rem, tm.duration >= 3600000);
    setRing(ring, tm.duration ? rem / tm.duration : 0);
  }
  $("#view-timer .ring-wrap").classList.toggle("warn", tm.state === "running" && rem <= 10000);
}

// Inputs: typing, clamping, scroll wheel and arrow keys
Object.entries(tmIn).forEach(([k, input]) => {
  input.addEventListener("input", () => { if (tm.state === "idle") tm.duration = tm.remaining = readInputs(); });
  input.addEventListener("blur", () => { input.value = clamp(parseInt(input.value, 10) || 0, 0, TM_MAX[k]); });
  input.addEventListener("focus", () => input.select());
  input.addEventListener("wheel", (e) => {
    e.preventDefault();
    const v = (parseInt(input.value, 10) || 0) + (e.deltaY < 0 ? 1 : -1);
    input.value = v > TM_MAX[k] ? 0 : v < 0 ? TM_MAX[k] : v; // wrap around
    tm.duration = tm.remaining = readInputs();
  }, { passive: false });
});
$$("#tm-presets .chip[data-sec]").forEach((b) => b.addEventListener("click", () => { tmSet(+b.dataset.sec * 1000); click(); }));
$("#tm-add").addEventListener("click", () => tmAdd(60000));
$("#tm-start").addEventListener("click", tmStart);
$("#tm-reset").addEventListener("click", tmReset);

/* =====================================================================
   POMODORO
   ===================================================================== */
const PM_LABEL = { work: "Focus", short: "Short break", long: "Long break" };
const todayKey = () => new Date().toDateString();
const pmSaved = store.get("timer.pomodoro", {});
const pm = {
  phase: "work",
  state: "idle", // idle | running | paused
  remaining: settings.work * 60000,
  endAt: 0,
  session: 1, // 1..4 within the current cycle
  doneToday: pmSaved.day === todayKey() ? pmSaved.count : 0,
};
const pmLen = (phase) => settings[phase] * 60000;
const pmRemaining = () => (pm.state === "running" ? Math.max(0, pm.endAt - Date.now()) : pm.remaining);

function pmSetPhase(phase, autoStart = false) {
  pm.phase = phase;
  pm.remaining = pmLen(phase);
  pm.state = "idle";
  if (autoStart) { pm.endAt = Date.now() + pm.remaining; pm.state = "running"; }
  pmUI();
}
function pmToggle() {
  if (pm.state === "running") {
    pm.remaining = pmRemaining();
    pm.state = "paused";
  } else {
    pm.endAt = Date.now() + pm.remaining;
    pm.state = "running";
    askNotify();
  }
  click();
  pmUI();
}
function pmNext(completed) {
  if (pm.phase === "work") {
    if (completed) {
      pm.doneToday++;
      store.set("timer.pomodoro", { day: todayKey(), count: pm.doneToday });
    }
    const next = pm.session % 4 === 0 ? "long" : "short";
    pmSetPhase(next, completed && settings.autoStart);
  } else {
    pm.session = pm.phase === "long" ? 1 : pm.session + 1;
    pmSetPhase("work", completed && settings.autoStart);
  }
}
function pmCheck() {
  if (pm.state !== "running" || Date.now() < pm.endAt) return;
  const finished = pm.phase;
  chime();
  pmNext(true);
  const msg = finished === "work"
    ? `Focus session done! Time for a ${pm.phase === "long" ? "long" : "short"} break ☕`
    : "Break over — back to focus 🎯";
  toast(msg);
  notify("Pomodoro", msg);
}
function pmReset() {
  pm.session = 1;
  pmSetPhase("work");
}
function pmUI() {
  const view = $("#view-pomodoro");
  view.dataset.phase = pm.phase;
  $$("#pm-pills button").forEach((b) => b.classList.toggle("active", b.dataset.phase === pm.phase));
  $("#pm-label").textContent = PM_LABEL[pm.phase] + (pm.phase === "work" ? ` · ${pm.session}/4` : "");
  $$("#pm-dots i").forEach((d, i) => d.classList.toggle("on", i < pm.session - (pm.phase === "work" ? 1 : 0)));
  $("#pm-count").textContent = pm.doneToday;

  const start = $("#pm-start");
  start.textContent = pm.state === "running" ? "Pause" : pm.state === "paused" ? "Resume" : "Start";
  start.classList.toggle("running", pm.state === "running");
  if (currentView === "pomodoro") moveIndicator();
  renderPomodoro();
}
function renderPomodoro() {
  const rem = pmRemaining();
  $("#pm-time").textContent = fmtDown(rem);
  setRing($("#pm-ring"), rem / pmLen(pm.phase));
}
$("#pm-start").addEventListener("click", pmToggle);
$("#pm-skip").addEventListener("click", () => { pmNext(false); click(); });
$("#pm-reset").addEventListener("click", pmReset);
$$("#pm-pills button").forEach((b) => b.addEventListener("click", () => pmSetPhase(b.dataset.phase)));

/* =====================================================================
   SETTINGS
   ===================================================================== */
const ACCENTS = ["#00e0ff", "#7c5cff", "#ff4f8b", "#ffb020", "#22d39a", "#ff6a3d", "#f5f5f5"];

function applyAccent(hex) {
  const n = parseInt(hex.slice(1), 16);
  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`);
  window.Background && Background.setAccent(hex);
  $$("#swatches button").forEach((b) => b.classList.toggle("active", b.dataset.c === hex));
}
function applyBg(mode) {
  window.Background && Background.setMode(mode);
  $$("#bg-seg button").forEach((b) => b.classList.toggle("active", b.dataset.bg === mode));
}

$("#swatches").innerHTML = ACCENTS.map((c) => `<button data-c="${c}" style="--c:${c}" aria-label="Accent ${c}"></button>`).join("");
$$("#swatches button").forEach((b) => b.addEventListener("click", () => {
  settings.accent = b.dataset.c; saveSettings(); applyAccent(settings.accent);
}));
$$("#bg-seg button").forEach((b) => b.addEventListener("click", () => {
  settings.bg = b.dataset.bg; saveSettings(); applyBg(settings.bg);
}));

const optH24 = $("#opt-h24"), optSound = $("#opt-sound"), optFr = $("#opt-fr"), optAuto = $("#opt-auto");
optH24.checked = settings.h24;
optSound.checked = settings.sound;
optFr.checked = settings.lang === "fr-CA";
optAuto.checked = settings.autoStart;

optH24.addEventListener("change", () => { settings.h24 = optH24.checked; saveSettings(); buildWorld(); lastWorldSec = -1; updateClock(new Date()); tmUI(); });
optSound.addEventListener("change", () => { settings.sound = optSound.checked; saveSettings(); click(); });
optFr.addEventListener("change", () => { settings.lang = optFr.checked ? "fr-CA" : "en-CA"; saveSettings(); buildWorld(); lastDateStr = ""; lastWorldSec = -1; updateClock(new Date()); });
optAuto.addEventListener("change", () => { settings.autoStart = optAuto.checked; saveSettings(); });

[["work", 120], ["short", 60], ["long", 60]].forEach(([key, max]) => {
  const input = $("#opt-" + key);
  input.value = settings[key];
  input.addEventListener("change", () => {
    settings[key] = clamp(parseInt(input.value, 10) || 1, 1, max);
    input.value = settings[key];
    saveSettings();
    if (pm.phase === key && pm.state === "idle") pmSetPhase(key);
    else pmUI();
  });
});

const openDrawer = () => { document.body.classList.add("drawer-open"); };
const closeDrawer = () => { document.body.classList.remove("drawer-open"); };
$("#settings-btn").addEventListener("click", openDrawer);
$("#drawer-close").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);

/* Fullscreen */
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}
$("#fullscreen-btn").addEventListener("click", toggleFullscreen);

/* Alarm buttons */
$("#alarm-ok").addEventListener("click", () => { hideAlarm(); tmReset(); });
$("#alarm-snooze").addEventListener("click", () => {
  hideAlarm();
  tm.duration = tm.remaining = 60000;
  tm.endAt = Date.now() + 60000;
  tm.state = "running";
  tmUI();
  toast("Snoozed for 1 minute 😴");
});

/* =====================================================================
   KEYBOARD SHORTCUTS
   ===================================================================== */
addEventListener("keydown", (e) => {
  if (e.target.matches("input") || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();

  if ($("#alarm").classList.contains("show")) {
    if (key === "escape" || key === "enter" || key === " ") { e.preventDefault(); hideAlarm(); tmReset(); }
    return;
  }
  if (key === "escape") return closeDrawer();
  if (key >= "1" && key <= "4") return showView(VIEWS[+key - 1]);
  if (key === "f") return toggleFullscreen();
  if (key === "s") return document.body.classList.toggle("drawer-open");

  const space = key === " ";
  if (space && e.target.closest("button")) return; // let the focused button handle it
  if (currentView === "stopwatch") {
    if (space) { e.preventDefault(); swToggle(); }
    else if (key === "l") swLap();
    else if (key === "r") swReset();
  } else if (currentView === "timer") {
    if (space) { e.preventDefault(); tmStart(); }
    else if (key === "r") tmReset();
  } else if (currentView === "pomodoro") {
    if (space) { e.preventDefault(); pmToggle(); }
    else if (key === "r") pmReset();
  }
});

/* =====================================================================
   MAIN LOOPS
   ===================================================================== */
// Smooth rendering (~60 fps) while the tab is visible
function frame() {
  const now = new Date();
  if (currentView === "clock") updateClock(now);
  if (currentView === "stopwatch") renderStopwatch();
  if (currentView === "timer" && tm.state !== "idle") renderTimer();
  if (currentView === "pomodoro") renderPomodoro();
  requestAnimationFrame(frame);
}

// Background checks keep working even when the tab is hidden
setInterval(() => {
  tmCheck();
  pmCheck();

  let title = "Timer";
  if (tm.state === "running") title = `⏳ ${fmtDown(tmRemaining())} · Timer`;
  else if (pm.state === "running") title = `🍅 ${fmtDown(pmRemaining())} · ${PM_LABEL[pm.phase]}`;
  else if (sw.running) title = `⏱ ${fmt(swNow())} · Stopwatch`;
  if (document.title !== title) document.title = title;
}, 250);

/* ---------------- Init ---------------- */
applyAccent(settings.accent);
applyBg(settings.bg);
buildWorld();
showView(currentView);
swButtons();
tmUI();
pmUI();
// Re-measure the sliding tab highlight whenever tab sizes change (e.g. once Poppins loads)
if ("ResizeObserver" in window) {
  const ro = new ResizeObserver(moveIndicator);
  $$(".tab").forEach((t) => ro.observe(t));
}
document.fonts?.ready.then(moveIndicator);
requestAnimationFrame(frame);
