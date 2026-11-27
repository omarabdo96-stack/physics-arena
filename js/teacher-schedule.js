import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { uid } from './content.js';
import { DAYS, STATUS, computePlan, parseISO, isSaturday, fmtDate, fmtTime, sortMakeup, safeUrl } from './schedule-core.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const YEAR_NAMES = { B: '1st Secondary', C: '2nd Secondary', T: '3rd Secondary' };
const STATUS_LABEL = { completed: 'Completed', current: 'Current week', upcoming: 'Upcoming', postponed: 'Postponed' };

// One document per year: schedule/{B|C|T} = { startDate, lessons: [{id,name,kind,status}], makeup: [{id,day,time,title,url}] }
export function createSchedule({ db, toast }) {
  const data = {};
  let year = 'T';
  const planEl = $('#schedPlan'), mkEl = $('#schedMakeup'), startIn = $('#schedStart'), startNote = $('#schedStartNote');

  async function fetchYear(y) {
    if (!data[y]) {
      const snap = await getDoc(doc(db, 'schedule', y));
      const d = snap.exists() ? snap.data() : {};
      data[y] = { startDate: d.startDate || '', lessons: d.lessons || [], makeup: d.makeup || [] };
    }
    return data[y];
  }
  const save = y => setDoc(doc(db, 'schedule', y), { startDate: data[y].startDate, lessons: data[y].lessons, makeup: data[y].makeup, updatedAtMs: Date.now() });
  const fail = () => { toast('Could not save. Check your connection.'); data[year] = undefined; load(year); };

  async function load(y) {
    year = y;
    $('#schedTitleH').textContent = `Schedule, ${YEAR_NAMES[y]}`;
    if (!data[y]) { planEl.innerHTML = '<div class="nothing">Loading...</div>'; mkEl.innerHTML = ''; }
    try { await fetchYear(y); }
    catch { planEl.innerHTML = '<div class="nothing">Could not load. Publish the new rules from firestore.rules (it now includes the schedule), then press Refresh.</div>'; mkEl.innerHTML = ''; return; }
    render();
  }

  function startHint() {
    const d = parseISO(data[year].startDate);
    if (!d) { startNote.textContent = 'Pick the first day of week 1. Every other week follows automatically.'; startNote.className = 'hint'; return; }
    if (!isSaturday(d)) { startNote.textContent = 'Heads up: this date is not a Saturday. Weeks are counted Saturday to Friday.'; startNote.className = 'hint warn'; return; }
    startNote.textContent = 'Week 1 starts on a Saturday. Good.'; startNote.className = 'hint';
  }

  function render() {
    const d = data[year];
    startIn.value = d.startDate || '';
    startHint();

    const { rows } = computePlan(d);
    if (!d.lessons.length) planEl.innerHTML = '<div class="nothing">No lessons yet. Press "Add lessons" and paste the names, one per line.</div>';
    else if (!d.startDate) planEl.innerHTML = '<div class="nothing">Pick the start date of week 1 above, then the dates will appear here.</div>';
    else planEl.innerHTML = rows.map((r, i) => `
      <div class="srow plan ${r.kind === 'break' ? 'brk' : ''}" data-id="${r.id}">
        <span class="idbadge ${r.kind === 'break' ? 'is-break' : ''}">${r.kind === 'break' ? 'Break' : '#' + r.no}</span>
        <div class="who"><b>${esc(r.name)}</b><small>${fmtDate(r.start)} to ${fmtDate(r.end)} <span class="stp st-${r.kind === 'break' ? 'break' : r.status}">${r.kind === 'break' ? 'Break week' : STATUS_LABEL[r.status]}${r.override !== 'auto' && r.kind !== 'break' ? ' (manual)' : ''}</span></small></div>
        <div class="acts">
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">Up</button>
          <button type="button" data-act="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">Down</button>
          <button type="button" data-act="edit">Edit</button>
          <button type="button" data-act="del" class="danger">Delete</button>
        </div>
      </div>`).join('');
    // lessons without a start date still need the controls, so show the plain list when no date is set
    if (d.lessons.length && !d.startDate) planEl.innerHTML += d.lessons.map((l, i) => `
      <div class="srow plan" data-id="${l.id}">
        <span class="idbadge">${l.kind === 'break' ? 'Break' : '#'}</span>
        <div class="who"><b>${esc(l.name)}</b></div>
        <div class="acts"><button type="button" data-act="up" ${i === 0 ? 'disabled' : ''}>Up</button><button type="button" data-act="down" ${i === d.lessons.length - 1 ? 'disabled' : ''}>Down</button><button type="button" data-act="edit">Edit</button><button type="button" data-act="del" class="danger">Delete</button></div>
      </div>`).join('');

    const mk = sortMakeup(d.makeup);
    mkEl.innerHTML = mk.length ? mk.map(m => {
      const day = DAYS.find(x => x.key === m.day) || DAYS[0];
      return `<div class="srow plan" data-id="${m.id}">
        <span class="idbadge mk">${day.en.slice(0, 3)}</span>
        <div class="who"><b>${esc(m.title)}</b><small>${day.en} at ${fmtTime(m.time) || '-'}${m.url ? ' · location link added' : ' · no location link'}</small></div>
        <div class="acts"><button type="button" data-act="edit">Edit</button><button type="button" data-act="del" class="danger">Delete</button></div>
      </div>`;
    }).join('') : '<div class="nothing">No makeup sessions. Press "Add makeup session".</div>';
  }

  /* ----- start date ----- */
  startIn.addEventListener('change', async () => {
    const v = startIn.value;
    if (v && !parseISO(v)) return;
    try { await fetchYear(year); data[year].startDate = v; await save(year); toast('Start date saved'); render(); } catch { fail(); }
  });

  /* ----- lessons dialog ----- */
  function askLessons({ edit, kind }) {
    return new Promise(res => {
      const d = $('#dlgLesson'), f = $('#lessonForm'), err = $('#lsErr'), txt = $('#lsText');
      const isBreak = kind === 'break';
      $('#lsDlgTitle').textContent = edit ? (isBreak ? 'Edit break week' : 'Edit lesson') : isBreak ? 'Add a break week' : 'Add lessons';
      $('#lsLabel').textContent = edit || isBreak ? 'Name' : 'Lesson names, one per line';
      $('#lsHint').textContent = edit || isBreak ? '' : 'Tip: copy the Lesson column from your sheet and paste it here. Each line becomes one lesson, one week each.';
      txt.rows = edit || isBreak ? 2 : 7;
      txt.placeholder = isBreak ? 'e.g. Mid-year break' : 'Electricity Concepts\nSeries & Parallel\nOhm\'s Law';
      txt.value = edit ? edit.name : '';
      $('#lsStatusRow').hidden = !edit || isBreak;
      $('#lsStatus').value = edit && edit.status ? edit.status : 'auto';
      err.hidden = true;
      let done = false;
      const finish = v => { if (done) return; done = true; d.close(); res(v); };
      f.onsubmit = e => {
        e.preventDefault();
        const lines = txt.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!lines.length) { err.textContent = 'Write at least one name.'; err.hidden = false; return; }
        finish({ names: edit || isBreak ? [lines.join(' ')] : lines, status: $('#lsStatus').value });
      };
      $('#lsCancel').onclick = () => finish(null);
      d.onclose = () => finish(null);
      d.showModal(); txt.focus();
    });
  }
  async function addLessons(kind) {
    const v = await askLessons({ kind }); if (!v) return;
    try {
      await fetchYear(year);
      v.names.forEach(name => data[year].lessons.push({ id: uid(), name, kind, status: 'auto' }));
      await save(year); toast(kind === 'break' ? 'Break added' : `${v.names.length} lesson${v.names.length === 1 ? '' : 's'} added`); render();
    } catch { fail(); }
  }
  $('#addLessonsBtn').addEventListener('click', () => addLessons('lesson'));
  $('#addBreakBtn').addEventListener('click', () => addLessons('break'));

  planEl.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const id = b.closest('.srow').dataset.id, list = data[year].lessons, i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    try {
      if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = b.dataset.act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; await save(year); render();
      } else if (b.dataset.act === 'del') {
        if (!confirm(`Delete "${list[i].name}"? The weeks after it move up by one.`)) return;
        list.splice(i, 1); await save(year); toast('Deleted'); render();
      } else {
        const v = await askLessons({ edit: list[i], kind: list[i].kind }); if (!v) return;
        list[i].name = v.names[0]; if (list[i].kind !== 'break') list[i].status = v.status;
        await save(year); toast('Saved'); render();
      }
    } catch { fail(); }
  });

  /* ----- makeup dialog ----- */
  function askMakeup(item) {
    return new Promise(res => {
      const d = $('#dlgMakeup'), f = $('#makeupForm'), err = $('#mkErr');
      $('#mkDlgTitle').textContent = item ? 'Edit makeup session' : 'Add makeup session';
      $('#mkDay').value = item ? item.day : 'sat'; $('#mkTime').value = item ? item.time : '';
      $('#mkTitle').value = item ? item.title : ''; $('#mkUrl').value = item ? item.url || '' : '';
      err.hidden = true;
      let done = false;
      const finish = v => { if (done) return; done = true; d.close(); res(v); };
      f.onsubmit = e => {
        e.preventDefault();
        const title = $('#mkTitle').value.trim(), time = $('#mkTime').value, raw = $('#mkUrl').value.trim(), url = raw ? safeUrl(raw) : '';
        const bad = !title ? 'Write the title / address.' : !time ? 'Pick the time.' : raw && !url ? 'The location link must start with https://' : '';
        if (bad) { err.textContent = bad; err.hidden = false; return; }
        finish({ day: $('#mkDay').value, time, title, url });
      };
      $('#mkCancel').onclick = () => finish(null);
      d.onclose = () => finish(null);
      d.showModal(); $('#mkTitle').focus();
    });
  }
  $('#addMakeupBtn').addEventListener('click', async () => {
    const v = await askMakeup(null); if (!v) return;
    try { await fetchYear(year); data[year].makeup.push({ id: uid(), ...v }); await save(year); toast('Added'); render(); } catch { fail(); }
  });
  mkEl.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.closest('.srow').dataset.id, list = data[year].makeup, i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    try {
      if (b.dataset.act === 'del') {
        if (!confirm('Delete this makeup session?')) return;
        list.splice(i, 1); await save(year); toast('Deleted'); render();
      } else {
        const v = await askMakeup(list[i]); if (!v) return;
        Object.assign(list[i], v); await save(year); toast('Saved'); render();
      }
    } catch { fail(); }
  });

  // build the select options once
  $('#mkDay').innerHTML = DAYS.map(d => `<option value="${d.key}">${d.en} - ${d.ar}</option>`).join('');
  $('#lsStatus').innerHTML = Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v.en} - ${v.ar}</option>`).join('');

  return { load, reload: y => { data[y] = undefined; return load(y); } };
}
