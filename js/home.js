import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMPTY = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>No news yet.</p><small>Important updates from Mr Omar will show up here.</small></div>';

// Home tab: announcements the teacher posted for this student's year.
export function initHome({ db, id }) {
  const root = $('#newsRoot');
  let loaded = false, loadedAt = 0;

  async function open(force) {
    if (!force && loaded && Date.now() - loadedAt < 3 * 60 * 1000) return;
    try {
      const snap = await getDoc(doc(db, 'announcements', id[0]));
      render(snap.exists() ? (snap.data().items || []) : []);
      loaded = true; loadedAt = Date.now();
    } catch {
      loaded = false;
      root.innerHTML = '<div class="empty"><p>Could not load the news.</p><small>Check your internet connection and reopen this tab.</small></div>';
    }
  }
  function render(items) {
    const list = [...items].sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
    if (!list.length) { root.innerHTML = EMPTY; return; }
    const now = Date.now();
    root.innerHTML = `<div class="news">${list.map(a => `
      <article class="nw ${a.important ? 'imp' : ''} ${a.pinned ? 'pin' : ''}">
        <header>
          ${a.pinned ? '<span class="nt pin">Pinned</span>' : ''}${a.important ? '<span class="nt imp">Important</span>' : ''}${now - a.at < 3 * 864e5 ? '<span class="nt new">New</span>' : ''}
          <time>${new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
        </header>
        ${a.title ? `<h4>${esc(a.title)}</h4>` : ''}
        <p>${esc(a.body)}</p>
      </article>`).join('')}</div>`;
  }
  return { open, dispose() {} };
}
