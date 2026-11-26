import { heroHTML, cardHTML, orderTrophies } from './achievements.js';
import { progressStats, CATALOG } from './trophies.js';
import { SITE } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n === null || n === undefined) ? '-' : (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const tone = p => (p >= 90 ? 'ex' : p >= 80 ? 'vg' : p >= 65 ? 'ok' : 'lo');
const YEARS = { B: '1st Secondary', C: '2nd Secondary', T: '3rd Secondary' };
const DAY = 864e5;
const ITEM_NAMES = { q: 'quiz', h: 'homework', p: 'practice' };

function ring(pct) {
  const c = 2 * Math.PI * 42, p = Math.max(0, Math.min(100, pct || 0));
  return `<svg class="ring ${tone(p)}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="val" style="stroke-dasharray:${(c * p / 100).toFixed(1)} ${c.toFixed(1)}"/><text x="50" y="56" text-anchor="middle">${fmt(p)}%</text></svg>`;
}
const ago = ms => {
  const d = Math.floor((Date.now() - ms) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/* automatic, plain-language observations for the parent */
function insights(m, p, name) {
  const out = [], first = name.split(' ')[0];
  const add = (k, t) => out.push({ k, t });
  if (!m) add('info', 'No marks have been uploaded yet. They will appear here after Mr Omar updates them.');
  else {
    const chs = m.chapters || [];
    const last = [...chs].reverse().find(c => c.earned > 0 || (c.weeks || []).some(w => w.att === 'absent')) || chs[chs.length - 1];
    if (last) {
      const ws = last.weeks || [];
      let idx = -1; ws.forEach((w, i) => { if (w.att === 'absent' || ['q', 'h', 'p'].some(k => w[k] && w[k].v !== null)) idx = i; });
      if (idx >= 0) {
        const w = ws[idx];
        if (w.att === 'absent') add('warn', `${first} was absent from ${w.title} (${last.title}).`);
        else {
          ['q', 'h', 'p'].forEach(k => { if (w[k] && w[k].v === null) add('warn', `No ${ITEM_NAMES[k]} mark has been recorded for ${w.title} yet.`); });
          const pct = w.max > 0 ? w.earned / w.max * 100 : 0;
          const before = ws.slice(0, idx).reverse().find(x => x.att !== 'absent' && x.max > 0 && ['q', 'h', 'p'].some(k => x[k] && x[k].v !== null));
          if (before) {
            const prev = before.earned / before.max * 100;
            if (prev - pct >= 20) add('warn', `${w.title} score dropped by ${Math.round(prev - pct)} points compared with the previous week.`);
            else if (pct - prev >= 20) add('good', `${w.title} score rose by ${Math.round(pct - prev)} points compared with the previous week.`);
          }
          if (pct >= 99.5) add('good', `Full marks in ${w.title}.`);
        }
      }
      if (last.absent >= 2) add('warn', `${last.absent} absences so far in ${last.title}.`);
      if (last.absent === 0 && last.present >= 4) add('good', `Perfect attendance in ${last.title}.`);
      if (last.of >= 5 && last.rank <= 3 && last.earned > 0) add('good', `Ranked #${last.rank} of ${last.of} students in ${last.title}.`);
      if (last.earned > 0 && last.percent < 50) add('warn', `The ${last.title} average is ${fmt(last.percent)}%. Extra practice and revision are recommended.`);
      const prevCh = chs[chs.indexOf(last) - 1];
      if (prevCh && prevCh.earned > 0 && last.earned > 0 && prevCh.rank - last.rank >= 5) add('good', `Climbed ${prevCh.rank - last.rank} places in the ranking compared with ${prevCh.title}.`);
    }
    chs.forEach(c => (c.extras || []).forEach(e => {
      if (e.v === null || !e.max) return;
      const pc = e.v / e.max * 100;
      if (pc < 50) add('warn', `${e.title}: ${fmt(e.v)} out of ${fmt(e.max)}. A review of this topic would help.`);
      else if (pc >= 90) add('good', `${e.title}: ${fmt(e.v)} out of ${fmt(e.max)}. Excellent!`);
    }));
  }
  const days = (p.loginDays || []).slice().sort();
  if (days.length) {
    const lastDay = new Date(days[days.length - 1] + 'T12:00:00').getTime(), gap = Math.floor((Date.now() - lastDay) / DAY);
    if (gap >= 7) add('warn', `${first} last visited the platform ${gap} days ago.`);
  }
  const order = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => order[a.k] - order[b.k]).slice(0, 7);
}

export function initParent({ data, tracker, ach, id, name }) {
  const root = $('#parentRoot');
  let ctx = null, chapter = 0, showAllTrophies = false, notesAll = false, loadedAt = 0;

  async function open(force) {
    tracker.flag('parent');                                   // unlocks the "Family Support" trophy
    if (!force && ctx && Date.now() - loadedAt < 2 * 60 * 1000) { paint(); return; }
    root.innerHTML = '<div class="empty"><div class="orbit pink"><i></i><i></i></div><p>Preparing the report...</p></div>';
    const safe = (p, d) => p.catch(() => d);
    const [marks, news, catalog, reds, weeks, tstate] = await Promise.all([
      safe(data.marks(force), null), safe(data.news(force), []), safe(data.catalog(force), { items: [] }),
      safe(data.reds(force), []), safe(data.content(force), []), safe(ach.getState(), null)
    ]);
    ctx = { marks, news, catalog, reds, weeks, tstate };
    const chs = (marks && marks.chapters) || [];
    chapter = Math.max(0, chs.length - 1);
    for (let i = chs.length - 1; i >= 0; i--) { if (chs[i].earned > 0) { chapter = i; break; } }
    loadedAt = Date.now(); paint();
  }

  function chapterBlock(c) {
    if (!c) return '';
    const bars = (c.weeks || []).map((w, i) => {
      const absent = w.att === 'absent', pct = !absent && w.max > 0 ? Math.round(w.earned / w.max * 100) : 0;
      return `<div class="col ${absent ? 'abs' : tone(pct)}" title="${esc(w.title)}: ${absent ? 'Absent' : fmt(w.earned) + '/' + fmt(w.max)}"><span class="pc">${absent ? 'A' : pct + '%'}</span><i style="--h:${Math.max(pct, absent ? 6 : 3)}%"></i><em>${i + 1}</em></div>`;
    }).join('');
    const extras = (c.extras || []).filter(e => e.v !== null).map(e => `<span class="chip">${esc(e.title)}: ${fmt(e.v)}/${fmt(e.max)}</span>`).join('');
    return `<div class="pp-ch">
      <div class="pp-chs"><div><small>Total</small><b>${fmt(c.earned)} <u>/ ${fmt(c.max)}</u></b></div><div>${ring(c.percent)}</div><div><small>Rank</small><b>#${c.rank}</b><u>of ${c.of}</u></div><div><small>Attendance</small><b>${c.present}</b><u>present, ${c.absent} absent</u></div></div>
      ${bars ? `<div class="chart">${bars}</div>` : ''}
      ${extras ? `<div class="pp-ex">${extras}</div>` : ''}
    </div>`;
  }

  function paint() {
    const { marks, news, catalog, reds, weeks, tstate } = ctx, p = tracker.data;
    const o = marks && marks.overall, chs = (marks && marks.chapters) || [];
    const sum = tstate && tstate.sum, ps = progressStats(p, weeks, reds);
    const tips = insights(marks, p, name);
    const notes = ((marks && marks.notes) || []).slice().reverse();
    const lastDay = (p.loginDays || []).slice().sort().pop();
    const weekAgo = Date.now() - 7 * DAY, videos7 = Object.values(p.videos || {}).filter(v => v.done && v.at >= weekAgo).length;
    const redRows = (catalog.items || []).filter(r => reds.some(x => x.revId === r.id)).map(r => {
      const x = reds.find(y => y.revId === r.id), on = x.expiresAtMs > Date.now();
      return `<div class="pp-rv"><b>${esc(r.title)}</b><span class="rv-st ${on ? 'ok' : 'exp'}">${on ? `Open, ${Math.max(1, Math.ceil((x.expiresAtMs - Date.now()) / DAY))} days left` : 'Expired'}</span></div>`;
    }).join('');
    const nws = [...news].sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at)).slice(0, 3);
    const trophies = tstate ? orderTrophies(tstate).filter(t => tstate.unlocked[t.id]) : [];
    const wa = `https://wa.me/${SITE.WHATSAPP}?text=${encodeURIComponent(`Hello Mr Omar, I am the parent of ${name} (ID ${id}).`)}`;

    root.innerHTML = `<div class="pp">
      <section class="pp-hero">
        <div class="av">${esc(name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</div>
        <div class="who"><h2>${esc(name)}</h2><p>ID ${esc(id)} <span>${YEARS[id[0]] || ''}</span></p></div>
        <div class="pp-kpis">
          <div class="kpi"><small>Overall</small>${ring(o ? o.percent : 0)}</div>
          <div class="kpi"><small>Rank in year</small><b>${o && o.rank ? '#' + o.rank : '-'}</b><span>${o && o.of ? 'of ' + o.of : ''}</span></div>
          <div class="kpi"><small>Trophy level</small><b>${sum ? sum.level : 1}</b><span>${sum ? sum.title : 'Rookie'}</span></div>
        </div>
      </section>

      <section class="ppc"><h3>This week at a glance <i class="ar">ملخص سريع</i></h3>
        <ul class="tips">${tips.length ? tips.map(t => `<li class="${t.k}"><i></i><span>${esc(t.t)}</span></li>`).join('') : '<li class="info"><i></i><span>Everything looks on track. No alerts right now.</span></li>'}</ul>
      </section>

      <div class="pp-two">
        <section class="ppc"><h3>Activity on the platform <i class="ar">النشاط</i></h3>
          <div class="pp-stats">
            <div><b>${lastDay ? ago(new Date(lastDay + 'T12:00:00').getTime()) : '-'}</b><small>Last visit</small></div>
            <div><b>${ps.totalDays}</b><small>Days visited</small></div>
            <div><b>${ps.streak}</b><small>Best daily streak</small></div>
            <div><b>${videos7}</b><small>Videos finished this week</small></div>
            <div><b>${ps.videos}</b><small>Videos finished in total</small></div>
            <div><b>${ps.weeksDone}/${ps.weeksWithVideos}</b><small>Weeks fully watched</small></div>
          </div>
        </section>
        <section class="ppc"><h3>Online revisions <i class="ar">المراجعات</i></h3>
          ${redRows || '<p class="soft">No paid revision has been unlocked yet.</p>'}
        </section>
      </div>

      <section class="ppc"><h3>Marks <i class="ar">الدرجات</i></h3>
        ${chs.length ? `${chs.length > 1 ? `<div class="pills" id="ppPills">${chs.map((c, i) => `<button type="button" class="pill ${i === chapter ? 'on' : ''}" data-c="${i}">${esc(c.title)}</button>`).join('')}</div>` : ''}<div id="ppChapter">${chapterBlock(chs[chapter])}</div>` : '<p class="soft">Marks will appear here after Mr Omar uploads them.</p>'}
      </section>

      <section class="ppc"><h3>Notes from Mr Omar <i class="ar">ملاحظات المدرس</i></h3>
        ${notes.length ? `<div class="pp-notes">${(notesAll ? notes : notes.slice(0, 6)).map(n => `<article class="pn"><header><b>${esc(n.w)}</b><small>${esc(n.ch)}</small></header>
          ${(n.pos || []).length || (n.neg || []).length ? `<div class="chips2">${(n.pos || []).map(x => `<span class="g">${esc(x)}</span>`).join('')}${(n.neg || []).map(x => `<span class="a">${esc(x)}</span>`).join('')}</div>` : ''}
          ${n.text ? `<p>${esc(n.text)}</p>` : ''}</article>`).join('')}</div>
          ${notes.length > 6 ? `<button type="button" class="btn small ghost" id="ppNotesMore">${notesAll ? 'Show fewer' : `Show all ${notes.length} notes`}</button>` : ''}`
          : '<p class="soft">No notes yet. Notes about participation and behaviour will show here.</p>'}
      </section>

      <section class="ppc"><h3>Achievements <i class="ar">الإنجازات</i></h3>
        ${sum ? `${heroHTML(sum)}
          ${trophies.length ? `<div class="tlist">${(showAllTrophies ? trophies : trophies.slice(0, 6)).map(t => cardHTML(t, tstate.res.get(t.id), tstate.unlocked[t.id], false)).join('')}</div>
          ${trophies.length > 6 ? `<button type="button" class="btn small ghost" id="ppTroMore">${showAllTrophies ? 'Show fewer' : `Show all ${trophies.length} unlocked trophies`}</button>` : ''}` : '<p class="soft">No trophies unlocked yet.</p>'}` : '<p class="soft">Trophies could not be loaded.</p>'}
      </section>

      ${nws.length ? `<section class="ppc"><h3>Latest news <i class="ar">آخر الأخبار</i></h3><div class="news">${nws.map(a => `<article class="nw ${a.important ? 'imp' : ''}"><header>${a.important ? '<span class="nt imp">Important</span>' : ''}<time>${new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time></header>${a.title ? `<h4>${esc(a.title)}</h4>` : ''}<p>${esc(a.body)}</p></article>`).join('')}</div></section>` : ''}

      <section class="ppc pp-contact"><h3>Talk to Mr Omar <i class="ar">تواصل مع المدرس</i></h3>
        <p class="soft">Questions about marks, attendance or revisions? Send a message on WhatsApp.</p>
        <a class="btn primary wide" target="_blank" rel="noopener" href="${wa}"><span class="btn-label">Message on WhatsApp <span class="ar">واتساب</span></span></a>
      </section>
    </div>`;
  }

  root.addEventListener('click', e => {
    if (!ctx) return;
    const pill = e.target.closest('#ppPills .pill');
    if (pill) { chapter = +pill.dataset.c; root.querySelectorAll('#ppPills .pill').forEach(x => x.classList.toggle('on', x === pill)); $('#ppChapter').innerHTML = chapterBlock(ctx.marks.chapters[chapter]); return; }
    if (e.target.closest('#ppTroMore')) { showAllTrophies = !showAllTrophies; paint(); }
    if (e.target.closest('#ppNotesMore')) { notesAll = !notesAll; paint(); }
  });
  $('#parentRefresh').addEventListener('click', () => open(true));

  return { open, dispose() {} };
}
