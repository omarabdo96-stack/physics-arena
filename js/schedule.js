import { DAYS, JS_DAY_TO_KEY, computePlan, fmtDate, fmtTime, sortMakeup, safeUrl } from './schedule-core.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { completed: ['Completed', 'تم'], current: ['This week', 'الأسبوع الحالي'], upcoming: ['Upcoming', 'قادم'], postponed: ['Postponed', 'مؤجل'] };
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>';

// Schedule tab: the year plan (dates follow the first week automatically) and the makeup sessions for this student's year.
export function initSchedule({ data }) {
  const root = $('#schedRoot');
  let loaded = false, loadedAt = 0;
  const ac = new AbortController();

  async function open(force) {
    if (!force && loaded && Date.now() - loadedAt < 3 * 60 * 1000) return;
    root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading the schedule...</p></div>';
    try { render(await data.schedule(force)); loaded = true; loadedAt = Date.now(); }
    catch {
      loaded = false;
      root.innerHTML = '<div class="empty"><p>Could not load the schedule.</p><small>Check your internet connection and press Refresh.</small></div>';
    }
  }

  function planHTML(d) {
    const { rows, done, total } = computePlan(d);
    if (!rows.length) return '<div class="empty"><div class="orbit"><i></i><i></i></div><p>The year plan is not published yet.</p><small>It will appear here as soon as Mr Omar adds it.</small></div>';
    const pct = total ? Math.round(done / total * 100) : 0;
    return `
      <div class="sc-prog"><div class="sc-bar"><i style="width:${pct}%"></i></div><span><b>${done}</b> of ${total} lectures completed</span></div>
      <div class="sc-table" role="table" aria-label="Year plan">
        <div class="sc-row sc-head" role="row"><span role="columnheader">No.</span><span role="columnheader">Lesson <i class="ar">الدرس</i></span><span role="columnheader">Status <i class="ar">الحالة</i></span><span role="columnheader">Start <i class="ar">البداية</i></span><span role="columnheader">End <i class="ar">النهاية</i></span></div>
        ${rows.map(r => r.kind === 'break'
          ? `<div class="sc-row sc-break" role="row"><span class="no">-</span><span class="ls">${esc(r.name)}</span><span class="st"><em class="stp st-break">Break</em></span><span class="dt" data-l="Start">${fmtDate(r.start)}</span><span class="dt" data-l="End">${fmtDate(r.end)}</span></div>`
          : `<div class="sc-row st-row-${r.status}" role="row" ${r.status === 'current' ? 'id="scNow"' : ''}><span class="no">${r.no}</span><span class="ls">${esc(r.name)}</span><span class="st"><em class="stp st-${r.status}">${LABEL[r.status] ? LABEL[r.status][0] : r.status}</em></span><span class="dt" data-l="Start">${fmtDate(r.start)}</span><span class="dt" data-l="End">${fmtDate(r.end)}</span></div>`).join('')}
      </div>`;
  }

  function makeupHTML(d) {
    const list = sortMakeup(d.makeup || []);
    const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
    const body = list.length ? `<div class="mk-list">${list.map(m => {
      const day = DAYS.find(x => x.key === m.day) || DAYS[0], url = m.url ? safeUrl(m.url) : '';
      return `<article class="mk-s ${m.day === todayKey ? 'today' : ''}">
        <div class="mk-day"><b>${day.en}</b><small class="ar">${day.ar}</small>${m.day === todayKey ? '<em class="stp st-current">Today</em>' : ''}</div>
        <div class="mk-time">${fmtTime(m.time) || '-'}</div>
        <div class="mk-title">${esc(m.title)}</div>
        ${url ? `<a class="mk-loc" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${PIN}<span>Location <i class="ar">الموقع</i></span></a>` : '<span class="mk-loc off">No location link</span>'}
      </article>`;
    }).join('')}</div>` : '<div class="empty"><p>No makeup sessions right now.</p><small>If a session is added, it will show up here.</small></div>';
    return `
      <div class="sc-week-note"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>
        <p>The week starts on <b>Saturday</b> and ends on <b>Friday</b>. <span class="ar">الأسبوع يبدأ من السبت وينتهي يوم الجمعة</span></p></div>
      ${body}`;
  }

  function render(d) {
    root.innerHTML = `
      <section class="sc-sec"><h4>Year plan <span class="ar">خطة العام الدراسي</span></h4>${planHTML(d)}</section>
      <section class="sc-sec"><h4>Makeup sessions <span class="ar">جدول التعويض</span></h4>${makeupHTML(d)}</section>`;
    const now = $('#scNow', root);
    if (now) now.scrollIntoView({ block: 'nearest' });
  }

  $('#schedRefresh').addEventListener('click', () => open(true), { signal: ac.signal });
  return { open, dispose() { ac.abort(); } };
}
