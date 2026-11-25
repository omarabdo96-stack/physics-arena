import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { uid } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const YEAR_NAMES = { B: '1st Secondary', C: '2nd Secondary', T: '3rd Secondary' };
const when = ms => new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// One document per year: announcements/{B|C|T} = { items: [ {id,title,body,important,pinned,at} ] }
export function createAnnouncements({ db, toast }) {
  const data = {};
  let year = 'T';
  const list = $('#annList');

  async function fetchYear(y) {
    if (!data[y]) { const snap = await getDoc(doc(db, 'announcements', y)); data[y] = { items: snap.exists() ? (snap.data().items || []) : [] }; }
    return data[y];
  }
  async function saveYear(y) { await setDoc(doc(db, 'announcements', y), { items: data[y].items, updatedAtMs: Date.now() }); }

  async function load(y) {
    year = y;
    $('#annTitleH').textContent = `Announcements, ${YEAR_NAMES[y]}`;
    if (!data[y]) list.innerHTML = '<div class="nothing">Loading...</div>';
    try { await fetchYear(y); } catch { list.innerHTML = '<div class="nothing">Could not load. Check the Firestore rules (see firestore.rules) and press Refresh.</div>'; return; }
    render();
  }

  function render() {
    const items = [...data[year].items].sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
    list.innerHTML = items.length ? items.map(a => `
      <article class="ann ${a.important ? 'imp' : ''}" data-id="${a.id}">
        <header><b>${esc(a.title || 'Announcement')}</b>
          ${a.pinned ? '<span class="tag pin">Pinned</span>' : ''}${a.important ? '<span class="tag">Important</span>' : ''}
          <small>${when(a.at)}</small></header>
        <p>${esc(a.body)}</p>
        <div class="ctl"><button type="button" data-act="edit">Edit</button><button type="button" data-act="del">Delete</button></div>
      </article>`).join('') : `<div class="nothing">No announcements for ${YEAR_NAMES[year]} yet. Press "New announcement".</div>`;
  }

  /* dialog */
  function askAnn(item) {
    return new Promise(res => {
      const d = $('#dlgAnn'), f = $('#annForm'), err = $('#annErr');
      $('#annDlgTitle').textContent = item ? 'Edit announcement' : 'New announcement';
      $('#annTitleIn').value = item ? item.title : ''; $('#annBody').value = item ? item.body : '';
      $('#annImp').checked = !!(item && item.important); $('#annPin').checked = !!(item && item.pinned);
      $('#annAll').checked = false; $('#annAllRow').hidden = !!item; err.hidden = true;
      let done = false;
      const finish = v => { if (done) return; done = true; d.close(); res(v); };
      f.onsubmit = e => {
        e.preventDefault();
        const body = $('#annBody').value.trim();
        if (!body) { err.textContent = 'Write the announcement text.'; err.hidden = false; return; }
        finish({ title: $('#annTitleIn').value.trim(), body, important: $('#annImp').checked, pinned: $('#annPin').checked, all: $('#annAll').checked });
      };
      $('#annCancel').onclick = () => finish(null);
      d.onclose = () => finish(null);
      d.showModal(); $('#annBody').focus();
    });
  }

  $('#newAnnBtn').addEventListener('click', async () => {
    const v = await askAnn(null); if (!v) return;
    const item = { id: uid(), title: v.title, body: v.body, important: v.important, pinned: v.pinned, at: Date.now() };
    const years = v.all ? ['B', 'C', 'T'] : [year];
    try {
      for (const y of years) { await fetchYear(y); data[y].items.push({ ...item }); await saveYear(y); }
      toast(v.all ? 'Posted to all years' : 'Posted'); render();
    } catch { toast('Could not post. Check your connection.'); data[year] = undefined; load(year); }
  });

  list.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.closest('.ann').dataset.id, items = data[year].items, i = items.findIndex(x => x.id === id);
    if (i < 0) return;
    try {
      if (b.dataset.act === 'del') {
        if (!confirm('Delete this announcement?')) return;
        items.splice(i, 1); await saveYear(year); toast('Deleted'); render();
      } else {
        const v = await askAnn(items[i]); if (!v) return;
        Object.assign(items[i], { title: v.title, body: v.body, important: v.important, pinned: v.pinned });
        await saveYear(year); toast('Saved'); render();
      }
    } catch { toast('Could not save. Check your connection.'); data[year] = undefined; load(year); }
  });

  return { load, reload: y => { data[y] = undefined; return load(y); } };
}
