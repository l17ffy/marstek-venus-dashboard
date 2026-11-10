// Replace readBattery() with real data. Units: W, kWh. Currently a simulation. / Заміни readBattery() на реальні дані.
let CAP = 2.1; const SPEED = 30; // SPEED: прискорення часу для наочності
const KEY = "venus-a-666e", today0 = () => new Date().toDateString();
const S = { soc: 59, t: 0, charged: 1.33, fromGrid: 1.33, discharged: 0, day: today0() };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function rollDay(){ // лічильники «сьогодні» скидаються опівночі
  if (S.day === today0()) return;
  S.day = today0(); S.charged = S.fromGrid = S.discharged = 0;
}
const LOAD = 232;
function readDemo(){
  S.t += 1; rollDay();
  let bat = -LOAD; // розряд на навантаження
  if ((S.soc >= 100 && bat > 0) || (S.soc <= 5 && bat < 0)) bat = 0;
  const backup = bat < 0 ? -bat : 0;
  const kwh = Math.abs(bat) / 1000 * SPEED / 3600;
  S.soc = Math.min(100, Math.max(0, S.soc + (bat / 1000 * SPEED / 3600) / CAP * 100));
  if (bat > 0) { S.fromGrid += kwh; S.charged += kwh; } // зарядка поки лише з мережі
  else if (bat < 0) S.discharged += kwh;
  return { soc: S.soc, bat, backup };
}

// ---- Реальні дані: bridge.py віддає відповідь ES.GetStatus на API ----
const API = "http://localhost:8765/status", FORCE_DEMO = location.search.includes("demo"); // ?demo — примусово демо
let SRC = "demo", TICKS = 0, busy = false;
async function readReal(){
  const j = await (await fetch(API, { cache: "no-store" })).json(), es = j.es;
  if (!j.ok || !es || typeof es.bat_soc !== "number") throw new Error("no data");
  S.live = true;
  if (es.bat_cap > 100) CAP = es.bat_cap / 1000; // Вт·год -> кВт·год
  // лічильники за сьогодні веде міст (переживають перезавантаження сторінки й працюють при закритій вкладці)
  S.charged = j.today.chg; S.fromGrid = j.today.grid; S.discharged = j.today.dis; S.soc = es.bat_soc;
  return { soc: es.bat_soc, bat: Math.round(j.bat), backup: j.backup };
}
async function readBattery(){
  if (!FORCE_DEMO) {
    try { const d = await readReal(); SRC = "live"; return d; }
    catch (e) { if (S.live) { SRC = "off"; rollDay(); return { soc: S.soc, bat: 0, backup: 0 }; } } // не підміняємо реальні дані симуляцією
  }
  SRC = "demo"; return readDemo();
}

const $ = id => document.getElementById(id);
const w = v => Math.round(v) + " " + t("W"), k = v => v.toFixed(2);
let LASTD = null;
async function tick(){
  if (busy) return; busy = true;
  try {
    LASTD = await readBattery(); LASTP = Math.round(LASTD.bat);
    for (const key in M) { const h = M[key].h; h.push(M[key].now()); if (h.length > 30) h.shift(); }
    paint();
    if (++TICKS % 5 === 0) save();
  } finally { busy = false; }
}
function paint(){
  const d = LASTD, p = LASTP;
  const chg = p > 15, dis = p < -15;
  $("kwh").textContent = k(d.soc / 100 * CAP);
  $("soc").textContent = Math.round(d.soc) + "%";
  $("state").textContent = chg ? t("st_chg") : dis ? t("st_dis") : t("st_idle");
  $("bar").style.strokeDashoffset = 565.5 * (1 - d.soc / 100);
  $("bk").textContent = w(d.backup); $("bt").textContent = w(Math.abs(p));
  $("cg").textContent = k(S.charged); $("lg").textContent = k(S.fromGrid);
  const tot = S.charged || 1;
  $("sg").style.width = (S.fromGrid / tot * 100) + "%";
  $("chg2").textContent = S.fromGrid > 0 ? k(S.fromGrid) + " " + t("kwh") : "-- " + t("kwh");
  $("dis").textContent = k(S.discharged) + " " + t("kwh");
  $("src").textContent = t("src_" + SRC);
  $("t").textContent = new Date().toLocaleTimeString(t("locale"));
  renderStats();
}
// Статистика для кожного блоку: «Зараз» і «Сьогодні» з поточних даних, решта — демо-історія.
let LASTP = 0;
const M = { // hv — яку величину брати з історії моста (chg/dis/grid/bak)
  backup:  { k: 0.9, now: () => Math.max(0, -LASTP), today: () => S.discharged, hv: b => b.bak, h: [] },
  battery: { k: 1.5, now: () => Math.abs(LASTP),     today: () => S.charged + S.discharged, hv: b => b.chg + b.dis, h: [] },
  charged: { k: 1,   now: () => Math.max(0, LASTP),  today: () => S.charged, hv: b => b.chg, h: [] },
  gridchg: { k: 0.8, now: () => Math.max(0, LASTP),  today: () => S.fromGrid, hv: b => b.grid, h: [] },
  dis:     { k: 0.7, now: () => Math.max(0, -LASTP), today: () => S.discharged, hv: b => b.dis, h: [] }
};
// Реальна історія з моста: /history?p=today|month|year|all, кеш 10 с
const HIST = {}, hbusy = {}, lbl = (p, k) => p === "today" ? (k * 4) + "–" + (k * 4 + 4) : p === "year" ? t("mon")[k] : String(k);
async function loadHist(p){
  const h = HIST[p]; if (hbusy[p] || (h && Date.now() - h.ts < 10000)) return;
  hbusy[p] = true;
  try {
    const j = await (await fetch(API.replace("/status", "/history?p=" + p), { cache: "no-store" })).json();
    HIST[p] = { ts: Date.now(), bars: j.bars }; renderStats();
  } catch (e) {} finally { hbusy[p] = false; }
}
const PAST_YEAR = [38, 41, 52, 60, 72, 81, 84, 76, 63, 50];
function monthBars(m){
  const n = new Date().getDate(), sc = m.today();
  return Array.from({ length: n }, (_, i) => ({ l: String(i + 1), v: i === n - 1 ? sc : m.k * Math.max(0.2, 1 + 0.7 * Math.sin(i * 1.7) + 0.5 * Math.cos(i * 0.6)) }));
}
function series(key, p){
  const m = M[key], sc = m.today(), nm = t("n_" + key);
  const kwh = (bars, avgL, div) => {
    const sum = bars.reduce((a, b) => a + b.v, 0);
    return [[sum.toFixed(2), t("s_total")], [(sum / div).toFixed(2), t(avgL)], [(sum / CAP).toFixed(1), t("s_cycles")]];
  };
  if (SRC === "live" && p !== "now") {
    const hd = HIST[p], bars = hd ? hd.bars.map(b => ({ l: lbl(p, b.k), v: m.hv(b) })) : [];
    const c = { today: ["t_today", "s_avgH", new Date().getHours() || 1], month: ["t_month", "s_avgD", bars.length || 1],
      year: ["t_year", "s_avgM", bars.length || 1], all: ["t_all", "s_avgY", bars.length || 1] }[p];
    return { t: nm + ", " + t(c[0]), bars, stats: kwh(bars, c[1], c[2]) };
  }
  if (p === "now"){
    const h = m.h, a = h.reduce((x, y) => x + y, 0) / (h.length || 1);
    return { t: nm + ": " + t("t_now"), bars: h.map(v => ({ l: "", v })),
      stats: [[Math.round(h[h.length - 1] || 0), t("s_pnow")], [a.toFixed(0), t("s_pavg")], [Math.round(Math.max(0, ...h)), t("s_pmax")]] };
  }
  if (p === "today"){
    const W = [.1, .05, .2, .3, .25, .1], n = Math.floor(new Date().getHours() / 4) + 1, ws = W.slice(0, n), tw = ws.reduce((a, b) => a + b, 0);
    const bars = ws.map((x, i) => ({ l: (i * 4) + "–" + (i * 4 + 4), v: sc * x / tw }));
    return { t: nm + ", " + t("t_today"), bars, stats: kwh(bars, "s_avgH", new Date().getHours() || 1) };
  }
  const days = monthBars(m), monthSum = days.reduce((a, b) => a + b.v, 0);
  if (p === "month") return { t: nm + ", " + t("t_month"), bars: days, stats: kwh(days, "s_avgD", days.length) };
  const mo = new Date().getMonth(), ybars = Array.from({ length: mo + 1 }, (_, i) => ({ l: t("mon")[i], v: i === mo ? monthSum : (PAST_YEAR[i] || 40) * m.k }));
  if (p === "year") return { t: nm + ", " + t("t_year"), bars: ybars, stats: kwh(ybars, "s_avgM", ybars.length) };
  const ysum = ybars.reduce((a, b) => a + b.v, 0), abars = [{ l: "2025", v: 310 * m.k }, { l: String(new Date().getFullYear()), v: ysum }];
  return { t: nm + ", " + t("t_all"), bars: abars, stats: kwh(abars, "s_avgY", abars.length) };
}
function renderBlock(el){
  const p = el.dataset.p || "today"; if (SRC === "live" && p !== "now") loadHist(p);
  const s = series(el.dataset.k, p), n = s.bars.length, mx = Math.max(...s.bars.map(b => b.v), 0.001);
  el.querySelector(".stt").textContent = s.t;
  const bars = el.querySelector(".bars"); bars.className = "bars" + (n > 8 ? " dense" : "");
  const html = s.bars.map((b, i) => '<div class="' + (i === n - 1 ? "today" : "") + '" title="' + b.l + ' ' + b.v.toFixed(2) + '"><span>' + (b.v >= 100 ? Math.round(b.v) : b.v >= 10 ? b.v.toFixed(1) : b.v.toFixed(2)) + '</span><i style="height:' + (b.v / mx * 60) + 'px"></i><span>' + b.l + '</span></div>').join("");
  if (el._h !== html) { el._h = html; bars.innerHTML = html; }
  el.querySelector(".srow").innerHTML = s.stats.map(x => '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join("");
}
function renderStats(){ document.querySelectorAll("details.m[open]").forEach(renderBlock); }
const PANEL = '<div class="stat"><div class="per" role="group" data-i18n-aria="period"><button data-p="now" data-i18n="p_now" aria-pressed="false"></button><button data-p="today" data-i18n="p_today" aria-pressed="true"></button><button data-p="month" data-i18n="p_month" aria-pressed="false"></button><button data-p="year" data-i18n="p_year" aria-pressed="false"></button><button data-p="all" data-i18n="p_all" aria-pressed="false"></button></div><div class="lbl stt" style="margin-top:14px"></div><div class="bars"></div><div class="srow"></div></div>';
document.querySelectorAll("details.m").forEach(el => {
  el.dataset.p = "today";
  el.insertAdjacentHTML("beforeend", PANEL);
  el.addEventListener("toggle", () => { if (el.open) renderBlock(el); });
  el.querySelector(".per").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    el.dataset.p = b.dataset.p;
    el.querySelectorAll(".per button").forEach(x => x.setAttribute("aria-pressed", x === b));
    renderBlock(el);
  });
});
function applyLang(){
  document.documentElement.lang = LANG;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $("lang").textContent = t("langBtn"); $("lang").setAttribute("aria-label", t("langAria"));
  document.querySelectorAll("details.m").forEach(el => { el._h = null; });
  if (LASTD) paint();
}
$("lang").addEventListener("click", () => {
  LANG = LANG === "uk" ? "en" : "uk";
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  applyLang();
});
addEventListener("pagehide", save);
applyLang(); tick(); setInterval(tick, 1000);
