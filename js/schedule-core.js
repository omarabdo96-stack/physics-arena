// Shared by the student page and the teacher dashboard.
// The week runs Saturday to Friday. The teacher sets only the start date of the first week;
// every other lesson follows automatically, one week each.

export const DAYS = [   // Saturday first, because that is how the week is counted
  { key: 'sat', en: 'Saturday',  ar: 'السبت' },
  { key: 'sun', en: 'Sunday',    ar: 'الأحد' },
  { key: 'mon', en: 'Monday',    ar: 'الإثنين' },
  { key: 'tue', en: 'Tuesday',   ar: 'الثلاثاء' },
  { key: 'wed', en: 'Wednesday', ar: 'الأربعاء' },
  { key: 'thu', en: 'Thursday',  ar: 'الخميس' },
  { key: 'fri', en: 'Friday',    ar: 'الجمعة' }
];
export const JS_DAY_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];   // Date.getDay() -> key

export const STATUS = {      // manual overrides the teacher can pick (auto = decided by today's date)
  auto:      { en: 'Automatic', ar: 'تلقائي' },
  completed: { en: 'Completed', ar: 'تم' },
  upcoming:  { en: 'Upcoming',  ar: 'قادم' },
  postponed: { en: 'Postponed', ar: 'مؤجل' }
};

// 'YYYY-MM-DD' <-> Date at local noon (noon avoids daylight-saving surprises)
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
export function toISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
export const fmtDate = d => `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;      // 29-8-2026, like the Canva sheet
export function fmtTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); if (!m) return '';
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
export const isSaturday = d => !!d && d.getDay() === 6;
export const startOfDay = d => { const x = new Date(d.getTime()); x.setHours(12, 0, 0, 0); return x; };

// Turns the saved plan into rows with dates and a status.
// plan = { startDate: 'YYYY-MM-DD', lessons: [ { id, name, kind: 'lesson'|'break', status: 'auto'|... } ] }
export function computePlan(plan, today = new Date()) {
  const start = parseISO(plan && plan.startDate);
  const list = (plan && plan.lessons) || [];
  if (!start) return { rows: [], done: 0, total: 0 };
  const t = startOfDay(today).getTime();
  let n = 0, done = 0, total = 0;
  const rows = list.map((l, i) => {
    const s = addDays(start, i * 7), e = addDays(s, 6);
    const isBreak = l.kind === 'break';
    let auto = t > e.getTime() ? 'completed' : t >= s.getTime() ? 'current' : 'upcoming';
    let status = l.status && l.status !== 'auto' ? l.status : auto;
    if (status === 'upcoming' && auto === 'current') status = 'current';   // never show "upcoming" for the week we are in
    if (!isBreak) { n++; total++; if (status === 'completed') done++; }
    return { id: l.id, name: l.name, kind: isBreak ? 'break' : 'lesson', no: isBreak ? null : n, start: s, end: e, status, auto, override: l.status || 'auto' };
  });
  return { rows, done, total };
}

// Sort makeup sessions by day (Saturday first) then time
export function sortMakeup(list) {
  const idx = k => Math.max(0, DAYS.findIndex(d => d.key === k));
  return [...list].sort((a, b) => idx(a.day) - idx(b.day) || String(a.time).localeCompare(String(b.time)));
}
export const safeUrl = u => { try { const x = new URL(String(u).trim()); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };
