import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { CATALOG, CATS, TIERS, evaluate, summarize, trophySVG } from './trophies.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateStr = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DAY = 864e5;

/* ---------- shared pieces (also used by the Parental Portal) ---------- */
export function heroHTML(sum) {
  const c = sum.counts, pct = Math.round(sum.done / sum.total * 100), R = 42, C = 2 * Math.PI * R;
  return `<div class="th-hero">
    <div class="th-lv"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="trk"/><circle cx="50" cy="50" r="${R}" class="val" style="stroke-dasharray:${(C * sum.pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <div><small>Level</small><b>${sum.level}</b></div></div>
    <div class="th-main">
      <h3>${sum.title} <i class="ar">${sum.ar}</i></h3>
      <p>${sum.points.toLocaleString('en-US')} points <span>${sum.toNext} to level ${sum.level + 1}</span></p>
      <span class="th-bar"><i style="--w:${sum.pct}%"></i></span>
    </div>
    <div class="th-tiers">
      ${['platinum', 'gold', 'silver', 'bronze'].map(t => `<div class="tt ${t}">${trophySVG(t, 'cup', c[t] ? 'on' : 'off')}<b>${c[t]}</b></div>`).join('')}
    </div>
    <div class="th-done"><b>${pct}%</b><small>${sum.done} of ${sum.total} trophies</small></div>
  </div>`;
}
export function cardHTML(t, r, at, isNew) {
  const state = at ? 'on' : (t.hidden ? 'secret' : 'off'), secret = state === 'secret';
  const pct = r && r.max ? Math.round(Math.min(1, r.cur / r.max) * 100) : 0;
  return `<article class="tc ${state} t-${t.tier} ${isNew ? 'new' : ''}">
    <div class="ico">${trophySVG(t.tier, t.icon, state)}</div>
    <div class="tx">
      <h4>${secret ? 'Secret trophy' : esc(t.name)}${secret ? '' : ` <i class="ar">${t.ar}</i>`}</h4>
      <p>${secret ? 'Keep exploring the platform to discover this one.' : esc(t.desc)}</p>
      <div class="meta"><span class="tier t-${t.tier}">${TIERS[t.tier].label}</span><span class="pts">${TIERS[t.tier].pts} pts</span>${at ? `<span class="when">${dateStr(at)}</span>` : ''}</div>
      ${!at && !secret && r && r.max > 1 ? `<div class="pg"><span><i style="--w:${pct}%"></i></span><b>${r.cur}/${r.max}</b></div>` : ''}
    </div>${isNew ? '<em class="newtag">NEW</em>' : ''}</article>`;
}
export function orderTrophies(state) {                      // unlocked (newest first), then closest to done, then the rest, secrets last
  const rank = t => {
    const at = state.unlocked[t.id], r = state.res.get(t.id);
    if (at) return [0, -at];
    if (t.hidden) return [3, 0];
    return [r.cur > 0 ? 1 : 2, -(r.cur / r.max)];
  };
  return [...CATALOG].sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1]; });
}

/* ---------- unlock celebration ---------- */
let actx;
const soundOn = () => localStorage.getItem('pa_sound') !== '0';
function chime(tier) {
  if (!soundOn()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, notes = tier === 'platinum' ? [659, 784, 988, 1319] : tier === 'gold' ? [523, 659, 784, 1047] : [523, 659, 784];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * .11); g.gain.linearRampToValueAtTime(.11, t + i * .11 + .02); g.gain.exponentialRampToValueAtTime(.001, t + i * .11 + .55);
      o.connect(g); g.connect(actx.destination); o.start(t + i * .11); o.stop(t + i * .11 + .6);
    });
  } catch { /* sound is optional */ }
}
function confetti(host, tier) {
  const colors = tier === 'platinum' ? ['#8FD8FF', '#B48CFF', '#FF9AD5', '#fff'] : tier === 'gold' ? ['#FFC83D', '#FFE9A0', '#FF6290', '#fff'] : tier === 'silver' ? ['#B8C0DC', '#fff', '#5B6EE1'] : ['#C77A3E', '#F2B07A', '#5B6EE1'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('i');
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    p.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 20}px;--r:${Math.random() * 540 - 270}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * .12}s`;
    host.appendChild(p);
  }
}
function celebrate(list) {
  if (!list.length) return;
  let box = $('#trophyToasts');
  if (!box) { box = document.createElement('div'); box.id = 'trophyToasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const show = list.slice(0, 4), more = list.length - show.length;
  show.forEach((t, i) => setTimeout(() => {
    const el = document.createElement('div');
    el.className = `ttoast t-${t.tier}`;
    el.innerHTML = `<div class="spark"></div>${trophySVG(t.tier, t.icon, 'on')}<div><small>Trophy unlocked</small><b>${esc(t.name)}</b><span>${TIERS[t.tier].label} · ${TIERS[t.tier].pts} pts</span></div>`;
    box.appendChild(el); confetti(el.querySelector('.spark'), t.tier); chime(t.tier);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3600);
  }, i * 4200));
  if (more > 0) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'ttoast more';
    el.innerHTML = `<div><b>+${more} more trophies unlocked</b><span>Open the Achievements tab to see them</span></div>`;
    box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3600);
  }, show.length * 4200);
}

/* ---------- the engine + the tab ---------- */
export function createTrophyCase({ db, id, data, tracker }) {
  const root = $('#achRoot');
  let state = null, cat = 'all', mode = 'all', timer = 0, busy = null;
  const ac = new AbortController(), sig = { signal: ac.signal };

  async function compute(force) {
    const [marks, weeks, reds, tdoc] = await Promise.all([
      data.marks(force).catch(() => null), data.content(force).catch(() => []),
      data.reds(force).catch(() => []), data.trophies(force).catch(() => ({ unlocked: {} }))
    ]);
    const res = evaluate({ marks, progress: tracker.data, weeks, reds });
    const unlocked = { ...(tdoc.unlocked || {}) }, fresh = [], now = Date.now();
    CATALOG.forEach(t => { if (res.get(t.id).done && !unlocked[t.id]) { unlocked[t.id] = now; fresh.push(t); } });
    if (fresh.length) {
      try {
        await setDoc(doc(db, 'trophies', id), { unlocked: Object.fromEntries(fresh.map(t => [t.id, now])), updatedAtMs: now }, { merge: true });
        data.set('trophies', { unlocked });
      } catch { fresh.forEach(t => delete unlocked[t.id]); fresh.length = 0; }   // not saved: try again next time
    }
    const known = new Set(Object.keys(unlocked).filter(k => CATALOG.some(t => t.id === k)));
    state = { res, unlocked, sum: summarize(known) };
    return fresh;
  }
  // Evaluates everything, celebrates anything new, and refreshes the tab if it is on screen.
  function refresh(force) {
    if (busy) return busy;
    busy = compute(force).then(fresh => { celebrate(fresh); if (!$('#panel-achievements').hidden) render(); return state; }).catch(() => state).finally(() => { busy = null; });
    return busy;
  }
  const unsub = tracker.onChange(() => { clearTimeout(timer); timer = setTimeout(() => refresh(false), 1500); });

  function render() {
    if (!state) { root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading your trophies...</p></div>'; return; }
    const now = Date.now(), fresh = t => state.unlocked[t.id] && now - state.unlocked[t.id] < 3 * DAY;
    const all = orderTrophies(state);
    const shown = all.filter(t => (cat === 'all' || t.cat === cat) && (mode === 'all' || (mode === 'on') === !!state.unlocked[t.id]));
    const next = all.filter(t => !state.unlocked[t.id] && !t.hidden && state.res.get(t.id).cur > 0 && state.res.get(t.id).max > 1)
      .sort((a, b) => (state.res.get(b.id).cur / state.res.get(b.id).max) - (state.res.get(a.id).cur / state.res.get(a.id).max)).slice(0, 3);
    root.innerHTML = `
      ${heroHTML(state.sum)}
      ${next.length ? `<div class="th-next"><h4>Almost there <i class="ar">قربت تخلّص</i></h4><div class="nx">${next.map(t => { const r = state.res.get(t.id); return `<div class="nxi t-${t.tier}">${trophySVG(t.tier, t.icon, 'off')}<div><b>${esc(t.name)}</b><span class="pg"><span><i style="--w:${Math.round(r.cur / r.max * 100)}%"></i></span><b>${r.cur}/${r.max}</b></span></div></div>`; }).join('')}</div></div>` : ''}
      <div class="th-bar2">
        <div class="pills">${CATS.map(([k, en, ar]) => `<button type="button" class="pill ${k === cat ? 'on' : ''}" data-cat="${k}">${en}</button>`).join('')}</div>
        <div class="th-modes">
          ${[['all', 'All'], ['on', 'Unlocked'], ['off', 'Locked']].map(([k, l]) => `<button type="button" class="${k === mode ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}
          <button type="button" class="snd ${soundOn() ? 'on' : ''}" id="sndBtn" aria-label="Trophy sound">${soundOn() ? 'Sound on' : 'Sound off'}</button>
        </div>
      </div>
      <div class="tlist">${shown.length ? shown.map(t => cardHTML(t, state.res.get(t.id), state.unlocked[t.id], fresh(t))).join('') : '<div class="nothing">No trophies here yet. Keep going!</div>'}</div>`;
  }

  root.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'), m = e.target.closest('[data-mode]'), s = e.target.closest('#sndBtn');
    if (c) { cat = c.dataset.cat; render(); }
    else if (m) { mode = m.dataset.mode; render(); }
    else if (s) { localStorage.setItem('pa_sound', soundOn() ? '0' : '1'); if (soundOn()) chime('silver'); render(); }
  }, sig);

  return {
    open() { render(); refresh(false); },
    refresh, getState: async () => state || refresh(false),
    dispose() { ac.abort(); unsub(); clearTimeout(timer); }
  };
}
