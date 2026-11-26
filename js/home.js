const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const EMPTY = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>No news yet.</p><small>Important updates from Mr Omar will show up here.</small></div>';
const ICON = {
  megaphone: '<svg viewBox="0 0 24 24"><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>'
};
const link = s => esc(s).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
const rel = ms => {
  const d = Math.floor((Date.now() - ms) / DAY);
  if (d <= 0) { const h = Math.floor((Date.now() - ms) / 36e5); return h < 1 ? 'Just now' : `${h} hour${h === 1 ? '' : 's'} ago`; }
  return d === 1 ? 'Yesterday' : d < 14 ? `${d} days ago` : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Home tab: announcements Mr Omar posted for this student's year.
export function initHome({ data, id }) {
  const root = $('#newsRoot'), key = 'pa_news_seen_' + id;
  let loaded = false, loadedAt = 0;
  const ac = new AbortController();

  async function open(force) {
    if (!force && loaded && Date.now() - loadedAt < 3 * 60 * 1000) return;
    try { render(await data.news(force)); loaded = true; loadedAt = Date.now(); }
    catch {
      loaded = false;
      root.innerHTML = '<div class="empty"><p>Could not load the news.</p><small>Check your internet connection and reopen this tab.</small></div>';
    }
  }
  function render(items) {
    const list = [...items].sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
    if (!list.length) { root.innerHTML = EMPTY; return; }
    const seen = Number(localStorage.getItem(key) || 0);
    const fresh = list.filter(a => a.at > seen).length;
    localStorage.setItem(key, String(Math.max(seen, ...list.map(a => a.at))));
    const feat = list.find(a => a.important) || list[0];
    const rest = list.filter(a => a !== feat);
    const card = (a, hero) => {
      const kind = a.important ? 'imp' : a.pinned ? 'pin' : '', icon = a.important ? ICON.alert : a.pinned ? ICON.pin : ICON.megaphone;
      const long = a.body.length > 260;
      return `<article class="nw ${kind} ${hero ? 'hero' : ''} ${a.at > seen ? 'fresh' : ''}">
        <div class="nw-ic">${icon}</div>
        <div class="nw-bd">
          <header>
            ${a.important ? '<span class="nt imp">Important</span>' : ''}${a.pinned ? '<span class="nt pin">Pinned</span>' : ''}${a.at > seen ? '<span class="nt new">New</span>' : ''}
            <time title="${new Date(a.at).toLocaleString('en-GB')}">${rel(a.at)}</time>
          </header>
          ${a.title ? `<h4>${esc(a.title)}</h4>` : ''}
          <p class="${long ? 'clamp' : ''}">${link(a.body)}</p>
          ${long ? '<button type="button" class="more">Read more</button>' : ''}
        </div></article>`;
    };
    root.innerHTML = `
      <div class="news-top"><span>${list.length} announcement${list.length === 1 ? '' : 's'}</span>${fresh ? `<span class="nt new">${fresh} new</span>` : ''}</div>
      <div class="news">${card(feat, true)}${rest.map(a => card(a, false)).join('')}</div>`;
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('.more'); if (!b) return;
    const p = b.previousElementSibling; const open = p.classList.toggle('clamp');
    b.textContent = open ? 'Read more' : 'Show less';
  }, { signal: ac.signal });
  return { open, dispose() { ac.abort(); } };
}
