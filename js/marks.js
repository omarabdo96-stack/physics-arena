import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n === null || n === undefined) ? '-' : (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const tone = p => (p >= 90 ? 'ex' : p >= 80 ? 'vg' : p >= 65 ? 'ok' : 'lo');
const ITEMS = [['q', 'Quiz', 'كويز'], ['h', 'Homework', 'الواجب'], ['p', 'Practice', 'التدريب']];

function ring(pct) {
  const c = 2 * Math.PI * 42, p = Math.max(0, Math.min(100, pct || 0));
  return `<svg class="ring ${tone(p)}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="val" style="stroke-dasharray:${(c * p / 100).toFixed(1)} ${c.toFixed(1)}"/><text x="50" y="56" text-anchor="middle">${fmt(p)}%</text></svg>`;
}
function rankBadge(r) {
  if (r === 1) return '<span class="medal gold">Top 1</span>';
  if (r === 2) return '<span class="medal silver">Top 2</span>';
  if (r === 3) return '<span class="medal bronze">Top 3</span>';
  return '';
}

export function initMarks({ db, id }) {
  const root = $('#marksRoot');
  let data = null, loadedAt = 0, cur = 0;
  const ac = new AbortController(), sig = { signal: ac.signal };

  async function open(force) {
    if (!force && data && Date.now() - loadedAt < 5 * 60 * 1000) return;
    root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading your marks...</p></div>';
    try {
      const snap = await getDoc(doc(db, 'marks', id));
      data = snap.exists() ? snap.data() : null; loadedAt = Date.now();
      if (data) {                                     // open the latest chapter that has something recorded
        const chs = data.chapters || [];
        let last = chs.length - 1;
        for (let i = chs.length - 1; i >= 0; i--) { if (chs[i].earned > 0) { last = i; break; } }
        cur = Math.max(0, last);
      }
      render();
    } catch {
      data = null;
      root.innerHTML = '<div class="empty"><p>Could not load your marks.</p><small>Check your internet connection and press Refresh.</small></div>';
    }
  }

  function chapterHTML(c) {
    if (!c) return '';
    const weeks = c.weeks || [], extras = c.extras || [];
    const bars = weeks.map((w, i) => {
      const absent = w.att === 'absent', pct = !absent && w.max > 0 ? Math.round(w.earned / w.max * 100) : 0;
      return `<div class="col ${absent ? 'abs' : tone(pct)}" title="${esc(w.title)}: ${absent ? 'Absent' : fmt(w.earned) + '/' + fmt(w.max)}">
        <span class="pc">${absent ? 'A' : pct + '%'}</span><i style="--h:${Math.max(pct, absent ? 6 : 3)}%"></i><em>${i + 1}</em></div>`;
    }).join('');
    const weekCards = weeks.map(w => {
      const absent = w.att === 'absent';
      return `<article class="wk ${absent ? 'absent' : ''}">
        <header><b>${esc(w.title)}</b>${absent ? '<span class="chip bad">Absent <i class="ar">غائب</i></span>' : `<span class="chip">${fmt(w.earned)} / ${fmt(w.max)}</span>`}</header>
        ${absent ? '' : ITEMS.filter(([k]) => w[k]).map(([k, en, ar]) => {
          const x = w[k], pct = x.v === null ? 0 : Math.round(x.v / x.max * 100);
          return `<div class="row"><span class="lb">${en} <i class="ar">${ar}</i></span><span class="bar ${tone(pct)}"><i style="--w:${pct}%"></i></span><span class="sc">${fmt(x.v)} / ${fmt(x.max)}</span></div>`;
        }).join('')}
      </article>`;
    }).join('');
    const exCards = extras.map(e => {
      const pct = e.v === null ? 0 : Math.round(e.v / e.max * 100);
      return `<article class="wk ex-${e.type}"><header><b>${esc(e.title)}</b><span class="chip">${fmt(e.v)} / ${fmt(e.max)}</span></header>
        <div class="row"><span class="lb">${e.type === 'exam' ? 'Exam' : 'Revision'} <i class="ar">${e.type === 'exam' ? 'امتحان' : 'مراجعة'}</i></span><span class="bar ${tone(pct)}"><i style="--w:${pct}%"></i></span><span class="sc">${e.v === null ? 'Not yet' : pct + '%'}</span></div></article>`;
    }).join('');
    return `
      <div class="mk-top">
        <div class="mk-card"><small>Chapter total <i class="ar">مجموع الباب</i></small><b>${fmt(c.earned)} <u>/ ${fmt(c.max)}</u></b>${ring(c.percent)}</div>
        <div class="mk-card"><small>Rank in chapter <i class="ar">الترتيب</i></small><b class="rk">#${c.rank}</b><span class="sub">of ${c.of} students</span>${rankBadge(c.rank)}</div>
        <div class="mk-card"><small>Attendance <i class="ar">الحضور</i></small><b>${c.present} <u>present</u></b><span class="sub">${c.absent} absent</span></div>
      </div>
      ${weeks.length ? `<h4 class="mk-h">Weekly performance <i class="ar">الأداء الأسبوعي</i></h4><div class="chart">${bars}</div>` : ''}
      ${weeks.length ? `<h4 class="mk-h">Week by week <i class="ar">تفاصيل الأسابيع</i></h4><div class="wk-grid">${weekCards}</div>` : ''}
      ${extras.length ? `<h4 class="mk-h">Revisions and exams <i class="ar">المراجعات والامتحانات</i></h4><div class="wk-grid">${exCards}</div>` : ''}`;
  }

  function render() {
    if (!data) {
      root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>No marks uploaded yet.</p><small>Your weekly marks, totals and rank will show here after Mr Omar updates them.</small></div>';
      return;
    }
    const o = data.overall || { earned: 0, max: 0, percent: 0, rank: 0, of: 0 }, chs = data.chapters || [];
    const when = data.updatedAtMs ? new Date(data.updatedAtMs).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    root.innerHTML = `
      ${when ? `<p class="mk-upd">Last updated ${esc(when)}</p>` : ''}
      <div class="mk-top big">
        <div class="mk-card"><small>All chapters <i class="ar">كل الأبواب</i></small><b>${fmt(o.earned)} <u>/ ${fmt(o.max)}</u></b>${ring(o.percent)}</div>
        <div class="mk-card"><small>Overall rank <i class="ar">الترتيب العام</i></small><b class="rk">#${o.rank}</b><span class="sub">of ${o.of} students in your year</span>${rankBadge(o.rank)}</div>
      </div>
      ${chs.length > 1 ? `<div class="pills" id="mkPills">${chs.map((c, i) => `<button type="button" class="pill ${i === cur ? 'on' : ''}" data-c="${i}">${esc(c.title)}</button>`).join('')}</div>` : ''}
      <div id="mkChapter">${chapterHTML(chs[cur])}</div>`;
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('.pill'); if (!b) return;
    cur = +b.dataset.c;
    root.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', p === b));
    $('#mkChapter').innerHTML = chapterHTML((data.chapters || [])[cur]);
  }, sig);
  $('#marksRefresh').addEventListener('click', () => open(true), sig);

  return { open, dispose() { ac.abort(); } };
}
