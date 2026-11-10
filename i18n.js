// Переклади інтерфейсу / UI translations. Додати мову: новий ключ в I18N з тими самими полями.
const I18N = {
  uk: {
    title: "Venus A 666e: наживо", src_demo: "Демо-дані", src_live: "Дані пристрою", src_off: "Немає зв'язку з мостом", updated: "оновлено",
    online: "Онлайн", onlineTitle: "Wi-Fi підключено", bat1: "1 батарея", batCount: "Кількість батарей",
    kwh: "кВт·год", W: "Вт", grid: "Мережа",
    n_backup: "Резервна мережа", n_battery: "Акумулятор", n_charged: "Заряджено", n_gridchg: "Зарядка від мережі", n_dis: "Розряджено",
    st_chg: "Заряджання", st_dis: "Розряджання", st_idle: "Очікування",
    period: "Період", p_now: "Зараз", p_today: "Сьогодні", p_month: "Місяць", p_year: "Рік", p_all: "Разом",
    t_now: "потужність за останні 30 с, Вт", t_today: "кВт·год (сьогодні, по 4 години)", t_month: "кВт·год (за місяць, по днях)",
    t_year: "кВт·год (за рік, по місяцях)", t_all: "кВт·год (за весь час, по роках)",
    s_total: "Усього, кВт·год", s_cycles: "Повних циклів",
    s_avgH: "Середнє за годину, кВт·год", s_avgD: "Середнє за день, кВт·год", s_avgM: "Середнє за місяць, кВт·год", s_avgY: "Середнє за рік, кВт·год",
    s_pnow: "Потужність зараз, Вт", s_pavg: "Середня за 30 с, Вт", s_pmax: "Максимум за 30 с, Вт",
    mon: ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"],
    langBtn: "EN", langAria: "Switch to English", locale: "uk-UA"
  },
  en: {
    title: "Venus A 666e: live", src_demo: "Demo data", src_live: "Device data", src_off: "Bridge unreachable", updated: "updated",
    online: "Online", onlineTitle: "Wi-Fi connected", bat1: "1 battery", batCount: "Number of batteries",
    kwh: "kWh", W: "W", grid: "Grid",
    n_backup: "Backup output", n_battery: "Battery", n_charged: "Charged", n_gridchg: "Grid charging", n_dis: "Discharged",
    st_chg: "Charging", st_dis: "Discharging", st_idle: "Idle",
    period: "Period", p_now: "Now", p_today: "Today", p_month: "Month", p_year: "Year", p_all: "Total",
    t_now: "power over the last 30 s, W", t_today: "kWh (today, per 4 hours)", t_month: "kWh (this month, per day)",
    t_year: "kWh (this year, per month)", t_all: "kWh (all time, per year)",
    s_total: "Total, kWh", s_cycles: "Full cycles",
    s_avgH: "Average per hour, kWh", s_avgD: "Average per day, kWh", s_avgM: "Average per month, kWh", s_avgY: "Average per year, kWh",
    s_pnow: "Power now, W", s_pavg: "Average over 30 s, W", s_pmax: "Peak over 30 s, W",
    mon: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    langBtn: "УКР", langAria: "Перейти на українську", locale: "en-GB"
  }
};
const LANG_KEY = "venus-lang";
let LANG = (() => {
  try { const v = localStorage.getItem(LANG_KEY); if (v in I18N) return v; } catch (e) {}
  return (navigator.language || "").toLowerCase().startsWith("uk") ? "uk" : "en";
})();
const t = key => I18N[LANG][key];
