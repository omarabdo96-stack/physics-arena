import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { TYPES, TYPE_ORDER } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  video: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/></svg>',
  sim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(35 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-35 12 12)"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  assess: '<svg viewBox="0 0 24 24"><path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>'
};
const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

let ytPromise;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return (ytPromise ||= new Promise(res => {
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    window.onYouTubeIframeAPIReady = res; document.head.appendChild(s);
  }));
}

export function initStudy({ db, id, name }) {
  const yearKey = id[0];
  const root = $('#studyRoot'), viewer = $('#viewer'), vBody = $('#vBody');
  let weeks = null, loadedAt = 0, openIdx = 0, shown = [];
  let player = null, tick = 0, wmTimer = 0;
  const ac = new AbortController(), sig = { signal: ac.signal };   // lets us remove every listener on sign-out

  /* ---------- list ---------- */
  async function open(force) {
    if (!force && weeks && Date.now() - loadedAt < 5 * 60 * 1000) return;
    root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading your weeks...</p></div>';
    try {
      const snap = await getDoc(doc(db, 'content', yearKey));
      weeks = snap.exists() ? (snap.data().weeks || []) : [];
      loadedAt = Date.now(); render();
    } catch {
      weeks = null;
      root.innerHTML = '<div class="empty"><p>Could not load your content.</p><small>Check your internet connection and press Refresh.</small></div>';
    }
  }
  function render() {
    shown = weeks.filter(w => w.visible !== false);
    if (!shown.length) {
      root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Your weeks will appear here.</p><small>Mr Omar has not published any lessons yet.</small></div>';
      return;
    }
    root.innerHTML = shown.map((w, wi) => `
      <article class="sw ${wi === openIdx ? 'open' : ''}" data-w="${wi}">
        <button type="button" class="sw-h" aria-expanded="${wi === openIdx}"><span>${esc(w.title)}</span><i class="chev"></i></button>
        <div class="sw-b">
          ${(w.lessons || []).map((l, li) => `
            <div class="sl"><h4>${esc(l.title)}</h4>
              ${TYPE_ORDER.map(t => {
                const its = (l.items || []).map((it, ii) => [it, ii]).filter(([it]) => it.type === t);
                return its.length ? `<div class="grp"><span class="grp-l">${TYPES[t].group} <i class="ar">${TYPES[t].groupAr}</i></span>
                  <div class="its">${its.map(([it, ii]) => `<button type="button" class="it it-${t}" data-l="${li}" data-i="${ii}">${ICON[t]}<span>${esc(it.title)}</span>${t === 'assess' ? '<em>opens in a new tab</em>' : ''}</button>`).join('')}</div></div>` : '';
              }).join('') || '<small class="none">No items yet.</small>'}
            </div>`).join('') || '<small class="none">No lessons in this week yet.</small>'}
        </div>
      </article>`).join('');
  }
  root.addEventListener('click', e => {
    const h = e.target.closest('.sw-h');
    if (h) { const wi = +h.closest('.sw').dataset.w; openIdx = openIdx === wi ? -1 : wi; render(); return; }
    const b = e.target.closest('button.it'); if (!b) return;
    const w = shown[+b.closest('.sw').dataset.w], it = w.lessons[+b.dataset.l].items[+b.dataset.i];
    openItem(it);
  }, sig);
  $('#studyRefresh').addEventListener('click', () => open(true), sig);

  /* ---------- viewer ---------- */
  function openItem(it) {
    if (it.type === 'assess') { window.open(it.ref, '_blank', 'noopener,noreferrer'); return; }
    $('#vTitle').textContent = it.title;
    const label = `${id} - ${name}`.slice(0, 26);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='190'><text x='24' y='110' transform='rotate(-22 150 95)' font-family='sans-serif' font-size='15' font-weight='700' fill='white' fill-opacity='0.14'>${label.replace(/[<>&'"]/g, '')}</text></svg>`;
    viewer.style.setProperty('--wm', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    $('#vFloat').textContent = id;
    viewer.hidden = false; document.body.classList.add('noscroll');
    if (it.type === 'video') buildVideo(it);
    else {
      vBody.innerHTML = `<div class="frame-wrap"><iframe src="${esc(it.ref)}" title="${esc(it.title)}" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock" allow="fullscreen" loading="eager"></iframe>${it.type === 'file' ? '<div class="corner-block" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>' : ''}</div>`;
    }
    moveFloat(); wmTimer = setInterval(moveFloat, 6000);
    $('#vClose').focus();
  }
  function moveFloat() {
    const f = $('#vFloat'); f.style.left = (8 + Math.random() * 70) + '%'; f.style.top = (14 + Math.random() * 68) + '%';
  }
  function closeViewer() {
    if (viewer.hidden) return;
    clearInterval(tick); clearInterval(wmTimer);
    try { player && player.destroy(); } catch { /* ignore */ }
    player = null; vBody.innerHTML = ''; viewer.hidden = true; $('#vShield').classList.remove('on');
    document.body.classList.remove('noscroll');
  }
  $('#vClose').addEventListener('click', closeViewer, sig);

  function buildVideo(it) {
    vBody.innerHTML = `<div class="vid" id="vid">
      <div id="ytHost"></div>
      <div class="vid-click" id="vidClick"></div>
      <div class="vid-top"></div>
      <div class="vid-mark"></div>
      <div class="vid-end" id="vidEnd"><button type="button" id="vidReplay">Play again</button></div>
      <div class="vid-load" id="vidLoad">Loading video...</div>
      <div class="vid-ctl">
        <button type="button" id="cPlay" aria-label="Play or pause"><svg viewBox="0 0 24 24" id="icPlay"><path d="M8 5v14l11-7z"/></svg></button>
        <input type="range" id="cSeek" min="0" max="1000" value="0" aria-label="Seek">
        <span class="time" id="cTime">0:00</span>
        <button type="button" id="cRate" class="txt" aria-label="Speed">1x</button>
        <button type="button" id="cMute" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg></button>
        <button type="button" id="cFull" aria-label="Fullscreen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div></div>`;
    const vid = $('#vid'), rates = [1, 1.25, 1.5, 1.75, 2, 0.75]; let ri = 0, dragging = false;
    loadYT().then(() => {
      if (viewer.hidden || !$('#ytHost')) return;
      player = new YT.Player('ytHost', {
        host: 'https://www.youtube-nocookie.com', videoId: it.ref,
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, origin: location.origin },
        events: {
          onReady: () => { $('#vidLoad').remove(); tick = setInterval(update, 250); },
          onStateChange: ev => {
            const s = ev.data;
            vid.classList.toggle('paused', s === 2 || s === 5 || s === -1);
            vid.classList.toggle('ended', s === 0);
            $('#icPlay').innerHTML = s === 1 ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
          }
        }
      });
    });
    function update() {
      if (!player || !player.getCurrentTime) return;
      const cur = player.getCurrentTime(), dur = player.getDuration() || 0;
      if (!dragging && dur) $('#cSeek').value = Math.round(cur / dur * 1000);
      $('#cTime').textContent = `${fmt(cur)} / ${fmt(dur)}`;
    }
    const toggle = () => { if (!player || !player.getPlayerState) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); };
    $('#vidClick').onclick = toggle; $('#cPlay').onclick = toggle;
    $('#vidReplay').onclick = () => { player.seekTo(0, true); player.playVideo(); };
    $('#cSeek').oninput = e => { dragging = true; const d = player.getDuration() || 0; player.seekTo(d * e.target.value / 1000, true); };
    $('#cSeek').onchange = () => { dragging = false; };
    $('#cRate').onclick = () => { ri = (ri + 1) % rates.length; player.setPlaybackRate(rates[ri]); $('#cRate').textContent = rates[ri] + 'x'; };
    $('#cMute').onclick = () => { player.isMuted() ? player.unMute() : player.mute(); $('#cMute').classList.toggle('off', player.isMuted()); };
    $('#cFull').onclick = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const req = vid.requestFullscreen || vid.webkitRequestFullscreen;
      if (req) req.call(vid); else vid.classList.toggle('pseudo');
    };
  }

  /* ---------- protection (deterrents, not a vault) ---------- */
  const shield = $('#vShield');
  const hideContent = () => { if (viewer.hidden) return; shield.classList.add('on'); try { player && player.pauseVideo && player.pauseVideo(); } catch { /* ignore */ } };
  const showContent = () => shield.classList.remove('on');
  document.addEventListener('visibilitychange', () => (document.hidden ? hideContent() : showContent()), sig);
  addEventListener('blur', hideContent, sig);
  addEventListener('focus', showContent, sig);
  shield.addEventListener('click', showContent, sig);
  viewer.addEventListener('contextmenu', e => e.preventDefault(), sig);
  viewer.addEventListener('dragstart', e => e.preventDefault(), sig);
  addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') { closeViewer(); return; }
    if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c', 'a'].includes(e.key.toLowerCase())) e.preventDefault();
  }, sig);
  addEventListener('keyup', e => {
    if (viewer.hidden || e.key !== 'PrintScreen') return;
    try { navigator.clipboard.writeText(''); } catch { /* ignore */ }
    hideContent(); setTimeout(showContent, 1800);
  }, sig);

  return { open, close: closeViewer, dispose() { closeViewer(); ac.abort(); } };
}
