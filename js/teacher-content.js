import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { TYPES, TYPE_ORDER, uid, buildItem } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortUrl = it => (it.type === 'video' ? `youtu.be/${it.ref}` : it.ref.replace(/^https:\/\//, '')).slice(0, 52);

// Generic weeks > lessons > items editor. Used for My Study (collection 'content', key = year)
// and for each paid revision (collection 'revision_content', key = revision id).
export function createTreeManager({ db, toast, root, collection }) {
  const data = {};              // key -> { weeks: [...] }
  let key = '';

  /* ----- load / save ----- */
  async function load(y) {
    key = y;
    if (!data[y]) {
      root.innerHTML = '<div class="nothing">Loading...</div>';
      try {
        const snap = await getDoc(doc(db, collection, y));
        data[y] = { weeks: snap.exists() ? (snap.data().weeks || []) : [] };
      } catch {
        root.innerHTML = '<div class="nothing">Could not load the content. Check the Firestore rules (see firestore.rules) and press Refresh.</div>';
        return;
      }
    }
    render();
  }
  async function save() {
    try { await setDoc(doc(db, collection, key), { weeks: data[key].weeks, updatedAt: serverTimestamp() }); toast('Saved'); }
    catch { toast('Could not save. Check your connection.'); delete data[key]; load(key); }
  }
  const weeks = () => data[key].weeks;
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };

  /* ----- small dialogs ----- */
  function askText(title, label, value = '') {
    return new Promise(res => {
      const d = $('#dlgText'), f = $('#textForm'), inp = $('#textVal');
      $('#textTitle').textContent = title; $('#textLabel').textContent = label; inp.value = value;
      let done = false;
      const finish = v => { if (done) return; done = true; d.close(); res(v); };
      f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (v) finish(v); };
      $('#textCancel').onclick = () => finish(null);
      d.onclose = () => finish(null);
      d.showModal(); inp.focus(); inp.select();
    });
  }
  function askItem(item) {
    return new Promise(res => {
      const d = $('#dlgItem'), f = $('#itemForm'), err = $('#itemErr');
      const typeSel = $('#itType'), title = $('#itTitle'), url = $('#itUrl'), hint = $('#itHint');
      const HINTS = {
        video: 'Paste the YouTube link (set the video to Unlisted on YouTube).',
        sim: 'Paste the simulation link. It opens inside the platform.',
        file: 'Paste the Google Drive or Google Docs link (sharing: anyone with the link can view).',
        assess: 'Paste the assignment link. This is the only item that opens outside the platform.'
      };
      typeSel.innerHTML = TYPE_ORDER.map(t => `<option value="${t}">${TYPES[t].label}</option>`).join('');
      typeSel.value = item ? item.type : 'video'; title.value = item ? item.title : '';
      url.value = item ? (item.type === 'video' ? `https://youtu.be/${item.ref}` : item.ref) : '';
      const setHint = () => { hint.textContent = HINTS[typeSel.value]; };
      typeSel.onchange = setHint; setHint(); err.hidden = true;
      let done = false;
      const finish = v => { if (done) return; done = true; d.close(); res(v); };
      f.onsubmit = e => {
        e.preventDefault();
        const r = buildItem(typeSel.value, title.value, url.value, item && item.id);
        if (r.error) { err.textContent = r.error; err.hidden = false; return; }
        finish(r.item);
      };
      $('#itemCancel').onclick = () => finish(null);
      d.onclose = () => finish(null);
      d.showModal(); title.focus();
    });
  }

  /* ----- render ----- */
  const btn = (act, label, extra = '') => `<button type="button" data-act="${act}" ${extra} aria-label="${label}">${label === 'Up' ? '&uarr;' : label === 'Down' ? '&darr;' : label}</button>`;
  function render() {
    const W = weeks();
    if (!W.length) { root.innerHTML = '<div class="nothing">No weeks yet. Press "Add week" to start.</div>'; return; }
    root.innerHTML = W.map((w, wi) => `
      <article class="week ${w.visible === false ? 'hid' : ''}" data-w="${wi}">
        <header class="wk-h">
          <b>${esc(w.title)}</b>${w.visible === false ? '<span class="tag">Hidden from students</span>' : ''}
          <span class="ctl">${btn('w-up', 'Up')}${btn('w-down', 'Down')}${btn('w-ren', 'Rename')}${btn('w-vis', w.visible === false ? 'Show' : 'Hide')}${btn('w-del', 'Delete')}</span>
        </header>
        ${(w.lessons || []).map((l, li) => `
          <div class="lesson" data-l="${li}">
            <div class="ls-h"><b>${esc(l.title)}</b>
              <span class="ctl">${btn('l-up', 'Up')}${btn('l-down', 'Down')}${btn('l-ren', 'Rename')}${btn('l-del', 'Delete')}</span></div>
            ${(l.items || []).map((it, ii) => `
              <div class="item t-${it.type}" data-i="${ii}">
                <span class="tp">${TYPES[it.type].label}</span><span class="it-t">${esc(it.title)}<small>${esc(shortUrl(it))}</small></span>
                <span class="ctl">${btn('i-up', 'Up')}${btn('i-down', 'Down')}${btn('i-edit', 'Edit')}${btn('i-del', 'Delete')}</span>
              </div>`).join('')}
            <button type="button" class="add-sm" data-act="i-add">+ Add item</button>
          </div>`).join('')}
        <button type="button" class="add-sm" data-act="l-add">+ Add lesson</button>
      </article>`).join('');
  }

  root.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const act = b.dataset.act, wEl = b.closest('.week'), lEl = b.closest('.lesson'), iEl = b.closest('.item');
    const wi = wEl ? +wEl.dataset.w : -1, li = lEl ? +lEl.dataset.l : -1, ii = iEl ? +iEl.dataset.i : -1;
    const W = weeks(), w = W[wi], l = w && w.lessons && w.lessons[li], arr = l && l.items;
    let changed = false;
    if (act === 'w-up') changed = move(W, wi, -1);
    else if (act === 'w-down') changed = move(W, wi, 1);
    else if (act === 'w-ren') { const t = await askText('Rename week', 'Week name', w.title); if (t) { w.title = t; changed = true; } }
    else if (act === 'w-vis') { w.visible = w.visible === false; changed = true; }
    else if (act === 'w-del') { if (confirm(`Delete "${w.title}" with all its lessons and items?`)) { W.splice(wi, 1); changed = true; } }
    else if (act === 'l-add') { const t = await askText('Add lesson', 'Lesson name'); if (t) { (w.lessons ||= []).push({ id: uid(), title: t, items: [] }); changed = true; } }
    else if (act === 'l-up') changed = move(w.lessons, li, -1);
    else if (act === 'l-down') changed = move(w.lessons, li, 1);
    else if (act === 'l-ren') { const t = await askText('Rename lesson', 'Lesson name', l.title); if (t) { l.title = t; changed = true; } }
    else if (act === 'l-del') { if (confirm(`Delete lesson "${l.title}" and its items?`)) { w.lessons.splice(li, 1); changed = true; } }
    else if (act === 'i-add') { const it = await askItem(null); if (it) { (l.items ||= []).push(it); changed = true; } }
    else if (act === 'i-up') changed = move(arr, ii, -1);
    else if (act === 'i-down') changed = move(arr, ii, 1);
    else if (act === 'i-edit') { const it = await askItem(arr[ii]); if (it) { arr[ii] = it; changed = true; } }
    else if (act === 'i-del') { if (confirm(`Delete "${arr[ii].title}"?`)) { arr.splice(ii, 1); changed = true; } }
    if (changed) { render(); await save(); }
  });

  async function addWeek() {
    if (!data[key]) return;
    const n = weeks().length + 1;
    const t = await askText('Add week', 'Week name', `Week ${n}`);
    if (t) { weeks().push({ id: uid(), title: t, visible: true, lessons: [] }); render(); await save(); }
  }

  return { load, addWeek, reload: y => { delete data[y]; return load(y); } };
}
