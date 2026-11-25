import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { mountWeeks } from './study.js';
import { SITE } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5, ACCESS_MS = 21 * DAY;                 // a code keeps the lessons open for 3 weeks

// Online Revisions: see what is for sale, unlock with a one-time code, then browse like My Study.
export function initRevisions({ db, id, name, viewer }) {
  const root = $('#revRoot');
  const yearKey = id[0];
  const ac = new AbortController(), sig = { signal: ac.signal };
  let catalog = null, reds = {}, loadedAt = 0, msg = null, opening = '';

  const active = r => r && r.expiresAtMs > Date.now();
  const left = r => Math.max(1, Math.ceil((r.expiresAtMs - Date.now()) / DAY));
  const wa = text => `https://wa.me/${SITE.WHATSAPP}?text=${encodeURIComponent(text)}`;

  async function open(force) {
    if (opening) return;
    if (!force && catalog && Date.now() - loadedAt < 2 * 60 * 1000) return;
    root.innerHTML = '<div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading...</p></div>';
    try {
      const [cat, rs] = await Promise.all([
        getDoc(doc(db, 'revisions_public', yearKey)),
        getDocs(query(collection(db, 'redemptions'), where('id', '==', id)))
      ]);
      catalog = cat.exists() ? cat.data() : { items: [], payment: '' };
      reds = {}; rs.docs.forEach(d => { const x = d.data(); reds[x.revId] = x; });
      loadedAt = Date.now(); renderList();
    } catch {
      catalog = null;
      root.innerHTML = '<div class="empty"><p>Could not load the revisions.</p><small>Check your internet connection and reopen this tab.</small></div>';
    }
  }

  function renderList() {
    const items = (catalog.items || []).filter(r => r.visible);
    const cards = items.map(r => {
      const red = reds[r.id], on = active(red);
      const status = on ? `<span class="rv-st ok">Unlocked, ${left(red)} day${left(red) === 1 ? '' : 's'} left</span>`
        : red ? '<span class="rv-st exp">Expired</span>' : '<span class="rv-st lock">Locked</span>';
      const action = on ? `<button type="button" class="btn small primary" data-open="${r.id}"><span class="btn-label">Open lessons <span class="ar">فتح</span></span></button>`
        : `<a class="btn small ghost" target="_blank" rel="noopener" href="${wa(`Hello Mr Omar, I paid for the revision "${r.title}"${r.price ? ' (' + r.price + ')' : ''}. My ID is ${id}. Here is the payment screenshot.`)}">Get your code on WhatsApp <span class="ar">اطلب الكود</span></a>`;
      return `<article class="rv ${on ? 'on' : ''}">
        <header><b>${esc(r.title)}</b>${r.price ? `<span class="rv-price">${esc(r.price)}</span>` : ''}</header>
        ${r.desc ? `<p>${esc(r.desc)}</p>` : ''}
        <div class="rv-foot">${status}${action}</div></article>`;
    }).join('');
    root.innerHTML = `
      ${items.length ? `<div class="rv-grid">${cards}</div>` : '<div class="empty"><div class="orbit"><i></i><i></i></div><p>No revisions open yet.</p><small>When Mr Omar publishes a paid revision, it will appear here.</small></div>'}
      ${items.length ? `<div class="rv-how"><h4>How to unlock <span class="ar">إزاي تفتح المراجعة</span></h4>
        ${catalog.payment ? `<p class="pay">${esc(catalog.payment)}</p>` : '<p class="pay">Pay Mr Omar, then send the payment screenshot on WhatsApp to get your code.</p>'}
        <ol><li>Pay using one of the methods above.</li><li>Press "Get your code on WhatsApp" and send the screenshot.</li><li>Type the code below. It works once and keeps the lessons open for 3 weeks.</li></ol></div>` : ''}
      ${items.length ? `<form class="rv-code" id="rvForm" autocomplete="off">
        <label for="rvCode">Revision code <span class="ar">كود المراجعة</span></label>
        <div class="rv-row"><input id="rvCode" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" spellcheck="false" inputmode="text"><button type="submit" class="btn small primary" id="rvGo"><span class="btn-label">Unlock <span class="ar">فتح</span></span><span class="spinner"></span></button></div>
        <p class="rv-msg ${msg ? msg.kind : ''}" id="rvMsg" ${msg ? '' : 'hidden'}>${msg ? esc(msg.text) : ''}</p></form>` : ''}`;
    msg = null;
  }

  async function openRevision(revId) {
    const r = (catalog.items || []).find(x => x.id === revId), red = reds[revId];
    if (!r || !active(red)) return;
    root.innerHTML = `
      <div class="rv-top"><button type="button" class="btn small ghost" id="rvBack">&larr; Back <span class="ar">رجوع</span></button>
        <div><h3>${esc(r.title)}</h3><span class="rv-st ok">Open until ${new Date(red.expiresAtMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${left(red)} day${left(red) === 1 ? '' : 's'} left</span></div></div>
      <div id="rvWeeks"><div class="empty"><div class="orbit"><i></i><i></i></div><p>Loading lessons...</p></div></div>`;
    $('#rvBack').addEventListener('click', () => { opening = ''; renderList(); });
    opening = revId;
    try {
      const snap = await getDoc(doc(db, 'revision_content', revId));
      const list = mountWeeks({ root: $('#rvWeeks'), viewer, sig, emptyHTML: '<div class="empty"><p>No lessons yet.</p><small>Mr Omar has not added the lessons to this revision yet.</small></div>' });
      list.render(snap.exists() ? (snap.data().weeks || []) : []);
    } catch {
      $('#rvWeeks').innerHTML = '<div class="empty"><p>Could not open the lessons.</p><small>Your access may have ended. Go back and check the status.</small></div>';
    }
  }

  function fmtCode(v) {
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  }
  async function redeem(raw) {
    const code = fmtCode(raw);
    if (code.length !== 9) return { kind: 'bad', text: 'Type the full code (8 letters and numbers).' };
    let cd;
    try {
      const snap = await getDoc(doc(db, 'revision_codes', code));
      if (!snap.exists()) return { kind: 'bad', text: 'This code is not valid. Check it and try again.' };
      cd = snap.data();
    } catch { return { kind: 'bad', text: 'This code is not valid for your account. Check it, or ask Mr Omar.' }; }
    if (cd.used) return { kind: 'bad', text: 'This code was already used.' };
    if (cd.year !== yearKey) return { kind: 'bad', text: 'This code is for a different school year.' };
    const now = Date.now();
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'revision_codes', code), { used: true, usedBy: id, usedAtMs: now });
      b.set(doc(db, 'redemptions', `${id}_${cd.revId}`), { id, revId: cd.revId, code, year: yearKey, redeemedAtMs: now, expiresAtMs: now + ACCESS_MS });
      await b.commit();
    } catch { return { kind: 'bad', text: 'Could not unlock. The code may have just been used, or your current access is still running.' }; }
    reds[cd.revId] = { id, revId: cd.revId, code, redeemedAtMs: now, expiresAtMs: now + ACCESS_MS };
    return { kind: 'ok', text: 'Unlocked! The lessons are open for 3 weeks.', revId: cd.revId };
  }

  root.addEventListener('input', e => { if (e.target.id === 'rvCode') e.target.value = fmtCode(e.target.value); }, sig);
  root.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openRevision(b.dataset.open); }, sig);
  root.addEventListener('submit', async e => {
    if (e.target.id !== 'rvForm') return;
    e.preventDefault();
    const go = $('#rvGo'), box = $('#rvMsg'); go.classList.add('loading');
    const r = await redeem($('#rvCode').value);
    go.classList.remove('loading');
    if (r.kind === 'ok') { msg = null; await openRevision(r.revId); }
    else { box.textContent = r.text; box.className = 'rv-msg ' + r.kind; box.hidden = false; }
  }, sig);

  $('#revRefresh').addEventListener('click', () => { opening = ''; open(true); }, sig);

  return { open, dispose() { ac.abort(); } };
}
