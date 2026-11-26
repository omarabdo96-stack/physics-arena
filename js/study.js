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

export function createViewer({ id, name, tracker }) {
  const viewer = $('#viewer'), vBody = $('#vBody');
  let player = null, tick = 0, wmTimer = 0, shieldOn = true;
  const ac = new AbortController(), sig = { signal: ac.signal };   // lets us remove every listener on sign-out

  function openItem(it) {
    tracker && tracker.opened(it);
    if (it.type === 'assess') { window.open(it.ref, '_blank', 'noopener,noreferrer'); return; }
    $('#vTitle').textContent = it.title;
    shieldOn = it.type !== 'sim';                 // simulations are interactive: no hide-on-blur there
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
      <div class="vid-stage">
        <div id="ytHost"></div>
        <div class="vid-click" id="vidClick"></div>
        <div class="vid-mark"></div>
        <div class="vid-end" id="vidEnd"><button type="button" id="vidReplay">Play again</button></div>
        <div class="vid-load" id="vidLoad">Loading video...</div>
      </div>
      <div class="vid-ctl">
        <button type="button" id="cPlay" aria-label="Play or pause"><svg viewBox="0 0 24 24" id="icPlay"><path d="M8 5v14l11-7z"/></svg></button>
        <input type="range" id="cSeek" min="0" max="1000" value="0" aria-label="Seek">
        <span class="time" id="cTime">0:00</span>
        <button type="button" id="cRate" class="txt" aria-label="Speed">1x</button>
        <div class="qwrap"><button type="button" id="cQual" class="txt" aria-label="Video quality">720p</button><div class="qmenu" id="qMenu" hidden></div></div>
        <button type="button" id="cMute" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg></button>
        <button type="button" id="cFull" aria-label="Fullscreen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div></div>`;
    const vid = $('#vid'), rates = [1, 1.25, 1.5, 1.75, 2, 0.75]; let ri = 0, dragging = false, qApplied = false, wanted = 'hd720';
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
            if (s === 1) { if (!qApplied) { qApplied = true; applyQuality(); } setTimeout(showQuality, 1600); }
            if (s === 0 && tracker) tracker.videoDone(it);
          }
        }
      });
    });
    function update() {
      if (!player || !player.getCurrentTime) return;
      const cur = player.getCurrentTime(), dur = player.getDuration() || 0;
      if (!dragging && dur) $('#cSeek').value = Math.round(cur / dur * 1000);
      $('#cTime').textContent = `${fmt(cur)} / ${fmt(dur)}`;
      if (tracker && dur > 30 && cur / dur >= 0.9) tracker.videoDone(it);
    }
    const toggle = () => { if (!player || !player.getPlayerState) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); };
    $('#vidClick').onclick = toggle; $('#cPlay').onclick = toggle;
    $('#vidReplay').onclick = () => { tracker && tracker.flag('replay'); player.seekTo(0, true); player.playVideo(); };
    $('#cSeek').oninput = e => { dragging = true; const d = player.getDuration() || 0; player.seekTo(d * e.target.value / 1000, true); };
    $('#cSeek').onchange = () => { dragging = false; };
    $('#cRate').onclick = () => { ri = (ri + 1) % rates.length; player.setPlaybackRate(rates[ri]); $('#cRate').textContent = rates[ri] + 'x'; if (rates[ri] >= 2 && tracker) tracker.flag('speed'); };
    /* quality: defaults to 720p; the student can pick another level (YouTube may still lower it on a slow connection) */
    const QLABEL = { highres: '4K', hd2160: '4K', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p', default: 'Auto', auto: 'Auto' };
    function applyQuality() { try { player.setPlaybackQuality(wanted); } catch { /* ignore */ } }
    function showQuality() {
      try { const q = player.getPlaybackQuality(); $('#cQual').textContent = (wanted === 'default' ? 'Auto ' : '') + (QLABEL[q] || QLABEL[wanted] || 'Auto'); } catch { /* ignore */ }
    }
    $('#cQual').onclick = e => {
      e.stopPropagation();
      const menu = $('#qMenu');
      if (!menu.hidden) { menu.hidden = true; return; }
      let levels = []; try { levels = (player.getAvailableQualityLevels() || []).filter(l => QLABEL[l] && l !== 'auto' && l !== 'default'); } catch { /* ignore */ }
      if (!levels.length) levels = ['hd1080', 'hd720', 'large', 'medium', 'small'];
      menu.innerHTML = [...levels, 'default'].map(l => `<button type="button" data-q="${l}" class="${l === wanted ? 'on' : ''}">${QLABEL[l]}</button>`).join('') + '<small>Higher quality needs a faster connection.</small>';
      menu.hidden = false;
    };
    $('#qMenu').onclick = e => {
      const b = e.target.closest('button[data-q]'); if (!b) return;
      wanted = b.dataset.q; applyQuality(); $('#qMenu').hidden = true;
      $('#cQual').textContent = QLABEL[wanted]; setTimeout(showQuality, 1800);
    };
    vid.addEventListener('pointerdown', e => { if (!e.target.closest('.qwrap')) $('#qMenu').hidden = true; });
    $('#cMute').onclick = () => { player.isMuted() ? player.unMute() : player.mute(); $('#cMute').classList.toggle('off', player.isMuted()); };
    let idleT;
    const setFs = on => { vid.classList.toggle('fs', on); wake(); };
    const wake = () => {
      vid.classList.remove('idle'); clearTimeout(idleT);
      if (vid.classList.contains('fs')) idleT = setTimeout(() => vid.classList.add('idle'), 2200);
    };
    ['pointermove', 'pointerdown', 'touchstart'].forEach(ev => vid.addEventListener(ev, wake, { passive: true }));
    const onFsChange = () => setFs((document.fullscreenElement || document.webkitFullscreenElement) === vid);
    vid.addEventListener('fullscreenchange', onFsChange);
    vid.addEventListener('webkitfullscreenchange', onFsChange);
    $('#cFull').onclick = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (vid.classList.contains('pseudo')) { vid.classList.remove('pseudo'); setFs(false); return; }
      const req = vid.requestFullscreen || vid.webkitRequestFullscreen;
      if (req) req.call(vid); else { vid.classList.add('pseudo'); setFs(true); }
    };
  }

  /* ---------- protection (deterrents, not a vault) ---------- */
  const shield = $('#vShield');
  const hideContent = () => { if (viewer.hidden || !shieldOn) return; shield.classList.add('on'); try { player && player.pauseVideo && player.pauseVideo(); } catch { /* ignore */ } };
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
    if (shieldOn && (e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'c', 'a'].includes(e.key.toLowerCase())) e.preventDefault();
  }, sig);
  addEventListener('keyup', e => {
    if (viewer.hidden || !shieldOn || e.key !== 'PrintScreen') return;
    try { navigator.clipboard.writeText(''); } catch { /* ignore */ }
    hideContent(); setTimeout(showContent, 1800);
  }, sig);

  return { openItem, close: closeViewer, dispose() { closeViewer(); ac.abort(); } };
}

// Weeks > lessons > items list, used by My Study and by an unlocked revision.
export function mountWeeks({ root, viewer, sig, emptyHTML }) {
  let shown = [], openIdx = 0;
  function render(weeks) {
    shown = (weeks || []).filter(w => w.visible !== false);
    if (!shown.length) { root.innerHTML = emptyHTML; return; }
    if (openIdx >= shown.length) openIdx = 0;
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
    if (h) { const wi = +h.closest('.sw').dataset.w; openIdx = openIdx === wi ? -1 : wi; render(shown); return; }
    const b = e.target.closest('button.it'); if (!b) return;
    const w = shown[+b.closest('.sw').dataset.w];
    viewer.openItem(w.lessons[+b.dataset.l].items[+b.dataset.i]);
  }, sig);
  return { render };
}

export function initStudy({ db, id, name, viewer }) {
  const yearKey = id[0];
  const root = $('#studyRoot');
  let loaded = false, loadedAt = 0;
  const ac = new AbortController(), sig = { signal: ac.signal };
  const list = mountWeeks({ root, viewer, sig, emptyHTML: '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Your weeks will appear here.</p><small>Mr Omar has not published any lessons yet.</small></div>' });

  async function open(force) {
    if (!force && loaded && Date.now() - loadedAt < 5 * 60 * 1000) return;
    root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading your weeks...</p></div>';
    try {
      const snap = await getDoc(doc(db, 'content', yearKey));
      list.render(snap.exists() ? (snap.data().weeks || []) : []);
      loaded = true; loadedAt = Date.now();
    } catch {
      loaded = false;
      root.innerHTML = '<div class="empty"><p>Could not load your content.</p><small>Check your internet connection and press Refresh.</small></div>';
    }
  }
  $('#studyRefresh').addEventListener('click', () => open(true), sig);
  return { open, dispose() { ac.abort(); } };
}
