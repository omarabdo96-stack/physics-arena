import { firebaseConfig, SITE } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { createContentManager } from './teacher-content.js';
import { getFirestore, doc, getDoc, getDocs, collection, writeBatch, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ID_RE = /^[BCT]\d{1,5}$/;
const YEARS = { B: '1st Sec', C: '2nd Sec', T: '3rd Sec' };

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb), db = getFirestore(fb);
// A second app instance creates student accounts so the teacher is never signed out.
let creator;
const creatorAuth = () => (creator ||= getAuth(initializeApp(firebaseConfig, 'creator')));

let students = [], priv = {}, year = 'T', query = '', view = 'students';

/* ---------- small helpers ---------- */
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000); }
const idNum = id => parseInt(id.slice(1), 10) || 0;
const emailFor = id => `${id.toLowerCase()}@${SITE.EMAIL_DOMAIN}`;
const toLatinDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function normPhone(p) {
  p = toLatinDigits(p).replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '20' + p.slice(1);          // Egyptian local format 01xxxxxxxxx
  return /^\d{10,15}$/.test(p) ? p : '';
}
function genPassword() {                                  // 8 chars, no look-alike characters
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  return [...buf].map(n => set[n % set.length]).join('');
}
function waLink(phone, s, pw, kind) {
  const site = new URL('./', location.href).href;
  const who = kind === 'parent' ? `ولي أمر الطالب ${s.name}` : s.name;
  const text =
`أهلاً ${who} 👋
بيانات الدخول لمنصة Physics Arena:
ID: ${s.id}
كلمة المرور: ${pw}
الرابط: ${site}
${kind === 'parent' ? 'ولي الأمر يدخل بنفس بيانات الطالب ثم يضغط على Parental Portal.\n' : ''}
Hello! Physics Arena login for ${s.name}:
ID: ${s.id}
Password: ${pw}
Link: ${site}
- Mr Omar Abd alhady`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

const content = createContentManager({ db, toast });

/* ---------- sign in / out ---------- */
const loginView = $('#loginView'), appView = $('#appView'), loginBtn = $('#loginBtn'), errBox = $('#loginErr');
const showErr = m => { errBox.textContent = m; errBox.hidden = false; };
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); errBox.hidden = true;
  const em = $('#em').value.trim(), pw = $('#pw').value;
  if (!em || !pw) return showErr('Enter your email and password.');
  loginBtn.classList.add('loading');
  try { await signInWithEmailAndPassword(auth, em, pw); }
  catch (err) {
    showErr(err.code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes.' : err.code === 'auth/network-request-failed' ? 'No internet connection.' : 'Email or password is incorrect.');
    loginBtn.classList.remove('loading');
  }
});
$('#logoutBtn').addEventListener('click', () => signOut(auth));
onAuthStateChanged(auth, async user => {
  loginBtn.classList.remove('loading');
  if (!user) { appView.hidden = true; loginView.hidden = false; $('#pw').value = ''; return; }
  if ((user.email || '').toLowerCase() !== SITE.TEACHER_EMAIL.toLowerCase()) {
    await signOut(auth); showErr('This page is for the teacher only.'); return;
  }
  loginView.hidden = true; appView.hidden = false;
  showYear(year, true);
  await loadAll();
});

/* ---------- data ---------- */
async function loadAll() {
  const bar = $('#appErr'); bar.hidden = true;
  try {
    const [a, b] = await Promise.all([getDocs(collection(db, 'students')), getDocs(collection(db, 'student_private'))]);
    students = a.docs.map(d => ({ id: d.id, ...d.data() }));
    priv = {}; b.docs.forEach(d => { priv[d.id] = d.data(); });
    render();
  } catch (err) {
    bar.hidden = false;
    bar.textContent = err.code === 'permission-denied'
      ? 'Firestore rules are not published yet. Paste the rules from firestore.rules into Firebase (Firestore Database > Rules > Publish).'
      : 'Could not load students. Check your connection and press Refresh.';
  }
}
$('#refreshBtn').addEventListener('click', async () => { await loadAll(); if (view === 'content') await content.reload(year); toast('Refreshed'); });

/* ---------- tabs ---------- */
const tabs = $('#tabs'), ink = $('#tabInk');
function showYear(y, first) {
  year = y;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.year === y)));
  const btn = $(`.tab[data-year="${y}"]`);
  requestAnimationFrame(() => { ink.style.width = btn.offsetWidth + 'px'; ink.style.transform = `translateX(${btn.offsetLeft}px)`; });
  if (!first) { render(); }
  if (view === 'content' && !first) content.load(y);
}
tabs.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showYear(b.dataset.year); });
addEventListener('resize', () => showYear(year, true));
document.fonts && document.fonts.ready.then(() => !appView.hidden && showYear(year, true));
$('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });

/* ---------- list ---------- */
function waBtn(kind, phone, s, pw) {
  const label = kind === 'parent' ? 'WhatsApp Parent' : 'WhatsApp Student';
  const cls = kind === 'parent' ? 'wa parent' : 'wa';
  return phone && pw
    ? `<a class="${cls}" href="${waLink(phone, s, pw, kind)}" target="_blank" rel="noopener">${label}</a>`
    : `<button class="${cls}" disabled title="Add a phone number with Edit">${label}</button>`;
}
function render() {
  ['B', 'C', 'T'].forEach(y => { $('#cnt-' + y).textContent = students.filter(s => s.year === y).length; });
  const inYear = students.filter(s => s.year === year);
  const rows = inYear.filter(s => !query || s.id.toLowerCase().includes(query) || (s.name || '').toLowerCase().includes(query)).sort((a, b) => idNum(a.id) - idNum(b.id));
  const active = inYear.filter(s => s.active !== false).length;
  $('#stats').innerHTML = `<span><b>${inYear.length}</b> students in ${YEARS[year]}</span><span><b>${active}</b> active</span>`;
  $('#list').innerHTML = rows.length ? rows.map(s => {
    const p = priv[s.id] || {};
    return `<article class="srow ${s.active === false ? 'off' : ''}" data-id="${s.id}">
      <span class="idbadge y-${s.year}">${s.id}</span>
      <div class="who"><b>${esc(s.name)}</b><small>${s.active === false ? 'Inactive' : 'Active'}</small></div>
      <div class="acts">
        <button data-act="pw">Password</button>
        ${waBtn('student', normPhone(p.studentPhone), s, p.password)}
        ${waBtn('parent', normPhone(p.parentPhone), s, p.password)}
        <button data-act="edit">Edit</button>
        <button data-act="toggle">${s.active === false ? 'Activate' : 'Deactivate'}</button>
      </div></article>`;
  }).join('') : `<div class="nothing">${inYear.length ? 'No student matches your search.' : `No students in ${YEARS[year]} yet. Use "Add student" or "Paste a list".`}</div>`;
}
$('#list').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.closest('.srow').dataset.id, s = students.find(x => x.id === id);
  if (btn.dataset.act === 'pw') openPw(s);
  if (btn.dataset.act === 'edit') openStudentDialog(s);
  if (btn.dataset.act === 'toggle') {
    const next = s.active === false;
    try { await updateDoc(doc(db, 'students', id), { active: next }); s.active = next; render(); toast(next ? `${id} activated` : `${id} deactivated`); }
    catch { toast('Could not update. Try again.'); }
  }
});

/* ---------- dialogs ---------- */
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }));

function openPw(s) {
  const p = priv[s.id] || {};
  $('#pwBody').innerHTML = `<h3>${esc(s.name)} <span class="ar">${s.id}</span></h3>
    <p class="pwmeta">Login for the student and the parent (same account).</p>
    <div class="pwbox"><code>${esc(p.password || '-')}</code><button type="button" id="copyPw">Copy</button></div>
    <div class="pwacts">${waBtn('student', normPhone(p.studentPhone), s, p.password)}${waBtn('parent', normPhone(p.parentPhone), s, p.password)}</div>`;
  $('#copyPw').onclick = () => { navigator.clipboard?.writeText(p.password || '').then(() => toast('Password copied')); };
  $('#dlgPw').showModal();
}

/* single student: add or edit */
let editing = null;
const fId = $('#fId'), fName = $('#fName'), fSp = $('#fSp'), fPp = $('#fPp'), sErr = $('#studentErr'), sSave = $('#studentSave');
fId.addEventListener('input', () => {
  let v = fId.value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[^BCT]+/, '');
  fId.value = v ? v[0] + v.slice(1).replace(/\D/g, '').slice(0, 5) : '';
});
function openStudentDialog(s) {
  editing = s || null; sErr.hidden = true;
  $('#dlgStudentTitle').textContent = s ? `Edit ${s.id}` : 'Add student';
  fId.value = s ? s.id : ''; fId.disabled = !!s;
  fName.value = s ? s.name : '';
  fSp.value = s ? (priv[s.id]?.studentPhone || '') : ''; fPp.value = s ? (priv[s.id]?.parentPhone || '') : '';
  $('#dlgStudent').showModal(); (s ? fName : fId).focus();
}
$('#addBtn').addEventListener('click', () => openStudentDialog(null));
$('#studentForm').addEventListener('submit', async e => {
  e.preventDefault(); sErr.hidden = true;
  const name = fName.value.trim(), sp = fSp.value.trim(), pp = fPp.value.trim();
  const bad = m => { sErr.textContent = m; sErr.hidden = false; };
  if (!editing && !ID_RE.test(fId.value)) return bad('Enter a valid ID: B, C or T followed by numbers. Example: T156');
  if (!name) return bad('Enter the student name.');
  if (sp && !normPhone(sp)) return bad('The student phone number does not look right.');
  if (pp && !normPhone(pp)) return bad('The parent phone number does not look right.');
  sSave.classList.add('loading');
  try {
    if (editing) {
      const b = writeBatch(db);
      b.update(doc(db, 'students', editing.id), { name });
      b.set(doc(db, 'student_private', editing.id), { studentPhone: sp, parentPhone: pp }, { merge: true });
      await b.commit();
      editing.name = name; priv[editing.id] = { ...(priv[editing.id] || {}), studentPhone: sp, parentPhone: pp };
      toast('Saved');
    } else {
      const r = await createStudent({ id: fId.value, name, sp, pp });
      if (r.status !== 'created') { sSave.classList.remove('loading'); return bad(r.msg); }
      toast(`${fId.value} added`);
    }
    $('#dlgStudent').close(); render();
  } catch { bad('Could not save. Check your connection and try again.'); }
  sSave.classList.remove('loading');
});

/* create one student: Auth account + two Firestore records */
async function createStudent({ id, name, sp, pp }) {
  id = id.toUpperCase();
  if ((await getDoc(doc(db, 'students', id))).exists()) return { status: 'exists', msg: `${id} already exists.` };
  const pw = genPassword(), cAuth = creatorAuth();
  try { await createUserWithEmailAndPassword(cAuth, emailFor(id), pw); }
  catch (err) {
    if (err.code === 'auth/email-already-in-use')
      return { status: 'conflict', msg: `${id} already has a login account that is not in your list. Delete that user in Firebase (Authentication > Users), then add it again.` };
    return { status: 'error', msg: `Could not create the login for ${id} (${err.code || 'error'}).` };
  }
  await signOut(cAuth);
  const b = writeBatch(db);
  b.set(doc(db, 'students', id), { id, name, year: id[0], active: true, createdAt: serverTimestamp() });
  b.set(doc(db, 'student_private', id), { studentPhone: sp || '', parentPhone: pp || '', password: pw });
  await b.commit();
  students.push({ id, name, year: id[0], active: true });
  priv[id] = { studentPhone: sp || '', parentPhone: pp || '', password: pw };
  return { status: 'created' };
}

/* paste a list */
const bulkLog = $('#bulkLog'), bulkRun = $('#bulkRun');
$('#bulkBtn').addEventListener('click', () => { $('#bulkText').value = ''; bulkLog.hidden = true; bulkLog.innerHTML = ''; $('#dlgBulk').showModal(); });
$('#bulkForm').addEventListener('submit', async e => {
  e.preventDefault();
  const lines = $('#bulkText').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return toast('Paste at least one line.');
  bulkLog.hidden = false; bulkLog.innerHTML = ''; bulkRun.classList.add('loading');
  const log = (cls, t) => { bulkLog.insertAdjacentHTML('beforeend', `<div class="${cls}">${esc(t)}</div>`); bulkLog.scrollTop = bulkLog.scrollHeight; };
  let made = 0;
  for (const line of lines) {
    const [rawId, name = '', sp = '', pp = ''] = line.split(/\t|,|;/).map(x => x.trim());
    const id = (rawId || '').toUpperCase();
    if (!ID_RE.test(id)) { log('warn', `Skipped "${line.slice(0, 40)}": the ID must be B, C or T plus numbers.`); continue; }
    if (!name) { log('warn', `${id}: skipped, name is missing.`); continue; }
    if ((sp && !normPhone(sp)) || (pp && !normPhone(pp))) { log('warn', `${id}: skipped, a phone number does not look right.`); continue; }
    try {
      const r = await createStudent({ id, name, sp, pp });
      if (r.status === 'created') { made++; log('ok', `${id} ${name}: added`); }
      else log(r.status === 'exists' ? 'warn' : 'bad', `${id}: ${r.msg}`);
    } catch { log('bad', `${id}: could not save, try this one again.`); }
    await new Promise(r => setTimeout(r, 350));            // be gentle with Firebase
  }
  log(made ? 'ok' : 'warn', `Done. ${made} added.`);
  bulkRun.classList.remove('loading'); render();
});

/* ---------- Students / Study content switch ---------- */
$('#seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  view = b.dataset.view;
  $$('#seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#studentsBlock').hidden = view !== 'students';
  $('#contentBlock').hidden = view !== 'content';
  if (view === 'content') content.load(year);
});
