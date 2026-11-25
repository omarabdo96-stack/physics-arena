import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { uid } from './content.js';
import { createTreeManager } from './teacher-content.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const YEAR_NAMES = { B: '1st Secondary', C: '2nd Secondary', T: '3rd Secondary' };
const when = ms => new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const ID_RE = /^[BCT]\d{1,5}$/;

function genCode() {                                   // XXXX-XXXX, no look-alike characters
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  const c = [...buf].map(n => set[n % set.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/*  revisions_public/{year}      = { items:[{id,title,price,desc,visible}], payment }   what students see before unlocking
 *  revision_content/{revId}     = { weeks:[...] }                                       the lessons (locked until a code is used)
 *  revision_codes/{CODE}        = { code, revId, year, used, usedBy, usedAtMs, forId, createdAtMs, title }
 */
export function createRevisions({ db, toast, studentExists, codeWa }) {
  const cache = {};
  let year = 'T', sel = '', codes = [];
  const tree = createTreeManager({ db, toast, root: $('#revTree'), collection: 'revision_content' });
  const cat = () => cache[year];

  async function load(y) {
    year = y; $('#revTitleH').textContent = `Online revisions, ${YEAR_NAMES[y]}`;
    if (!cache[y]) {
      try {
        const snap = await getDoc(doc(db, 'revisions_public', y));
        cache[y] = { items: snap.exists() ? (snap.data().items || []) : [], payment: snap.exists() ? (snap.data().payment || '') : '' };
      } catch { $('#revPicker').innerHTML = '<div class="nothing">Could not load. Check the Firestore rules (see firestore.rules) and press Refresh.</div>'; $('#revEditor').hidden = true; return; }
    }
    $('#revPay').value = cat().payment;
    if (!cat().items.some(r => r.id === sel)) sel = cat().items[0] ? cat().items[0].id : '';
    renderPicker(); await showRev();
  }
  async function saveCat() {
    await setDoc(doc(db, 'revisions_public', year), { items: cat().items, payment: cat().payment, updatedAtMs: Date.now() });
  }

  function renderPicker() {
    const items = cat().items;
    $('#revPicker').innerHTML = items.length
      ? items.map(r => `<button type="button" class="pill ${r.id === sel ? 'on' : ''}" data-id="${r.id}">${esc(r.title)}${r.visible ? '' : ' (hidden)'}</button>`).join('')
      : '<div class="nothing">No revisions for this year yet. Press "Add revision".</div>';
  }
  async function showRev() {
    const r = cat().items.find(x => x.id === sel);
    $('#revEditor').hidden = !r;
    if (!r) return;
    $('#revName').value = r.title; $('#revPrice').value = r.price || ''; $('#revDesc').value = r.desc || ''; $('#revVis').checked = !!r.visible;
    await tree.load(r.id);
    await loadCodes();
  }

  $('#revPicker').addEventListener('click', async e => {
    const b = e.target.closest('.pill'); if (!b) return;
    sel = b.dataset.id; renderPicker(); await showRev();
  });
  $('#addRevBtn').addEventListener('click', async () => {
    const r = { id: uid(), title: 'New revision', price: '', desc: '', visible: false };
    cat().items.push(r); sel = r.id;
    try { await saveCat(); toast('Revision added. Set its name and price, then add content.'); } catch { toast('Could not save.'); }
    renderPicker(); await showRev(); $('#revName').focus(); $('#revName').select();
  });
  $('#revSave').addEventListener('click', async () => {
    const r = cat().items.find(x => x.id === sel); if (!r) return;
    const t = $('#revName').value.trim(); if (!t) return toast('Enter the revision name.');
    Object.assign(r, { title: t, price: $('#revPrice').value.trim(), desc: $('#revDesc').value.trim(), visible: $('#revVis').checked });
    try { await saveCat(); toast('Saved'); renderPicker(); } catch { toast('Could not save.'); }
  });
  $('#revPaySave').addEventListener('click', async () => {
    cat().payment = $('#revPay').value.trim();
    try { await saveCat(); toast('Payment details saved'); } catch { toast('Could not save.'); }
  });
  $('#revDelete').addEventListener('click', async () => {
    const r = cat().items.find(x => x.id === sel); if (!r) return;
    if (!confirm(`Delete the revision "${r.title}" and all its content? Students who already unlocked it lose access.`)) return;
    cat().items = cat().items.filter(x => x.id !== sel);
    try { await saveCat(); await deleteDoc(doc(db, 'revision_content', sel)); toast('Deleted'); } catch { toast('Could not delete.'); }
    sel = cat().items[0] ? cat().items[0].id : ''; renderPicker(); await showRev();
  });
  $('#revAddWeek').addEventListener('click', () => tree.addWeek());

  /* ---------- codes ---------- */
  async function loadCodes() {
    const box = $('#revCodes'); box.innerHTML = '<div class="nothing">Loading codes...</div>';
    try {
      const snap = await getDocs(query(collection(db, 'revision_codes'), where('revId', '==', sel)));
      codes = snap.docs.map(d => d.data()).sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch { box.innerHTML = '<div class="nothing">Could not load the codes.</div>'; return; }
    renderCodes();
  }
  function renderCodes() {
    const r = cat().items.find(x => x.id === sel);
    const used = codes.filter(c => c.used).length;
    $('#revCodeStats').textContent = codes.length ? `${codes.length} codes, ${used} used, ${codes.length - used} available` : '';
    $('#revCodes').innerHTML = codes.length ? codes.map(c => `
      <div class="code ${c.used ? 'used' : ''}" data-code="${c.code}">
        <code>${c.code}</code>
        <span class="st">${c.used ? `Used by ${esc(c.usedBy)}${c.usedAtMs ? ', ' + when(c.usedAtMs) : ''}` : (c.forId ? `For ${esc(c.forId)}` : 'Available')}</span>
        <span class="ctl">
          <button type="button" data-act="copy">Copy</button>
          ${c.forId && !c.used ? `${waBtn('student', c, r)}${waBtn('parent', c, r)}` : ''}
          ${c.used ? '' : '<button type="button" data-act="del">Delete</button>'}
        </span>
      </div>`).join('') : '<div class="nothing">No codes yet. Generate some below.</div>';
  }
  function waBtn(kind, c, r) {
    const url = codeWa(kind, c.forId, c.code, r ? r.title : '');
    const label = kind === 'parent' ? 'WhatsApp Parent' : 'WhatsApp Student';
    return url ? `<a class="wa ${kind === 'parent' ? 'parent' : ''}" href="${url}" target="_blank" rel="noopener">${label}</a>` : '';
  }
  $('#revGen').addEventListener('click', async () => {
    const r = cat().items.find(x => x.id === sel); if (!r) return;
    const forId = $('#revFor').value.trim().toUpperCase();
    let n = Math.max(1, Math.min(50, parseInt($('#revQty').value, 10) || 1));
    if (forId) {
      if (!ID_RE.test(forId) || forId[0] !== year) return toast(`The student ID must start with ${year} for ${YEAR_NAMES[year]}.`);
      if (!studentExists(forId)) return toast(`${forId} is not in your students list.`);
      n = 1;
    }
    try {
      for (let i = 0; i < n; i++) {
        const code = genCode();
        await setDoc(doc(db, 'revision_codes', code), { code, revId: sel, year, used: false, usedBy: '', usedAtMs: 0, forId, createdAtMs: Date.now() + i, title: r.title });
      }
      toast(n === 1 ? 'Code created' : `${n} codes created`); $('#revFor').value = ''; await loadCodes();
    } catch { toast('Could not create the codes. Check your connection.'); }
  });
  $('#revCodes').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const code = b.closest('.code').dataset.code;
    if (b.dataset.act === 'copy') { navigator.clipboard && navigator.clipboard.writeText(code).then(() => toast('Code copied')); return; }
    if (!confirm(`Delete the code ${code}?`)) return;
    try { await deleteDoc(doc(db, 'revision_codes', code)); await loadCodes(); } catch { toast('Could not delete.'); }
  });

  return { load, reload: y => { delete cache[y]; return load(y); } };
}
