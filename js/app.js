import { firebaseConfig, SITE } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initStudy } from './study.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const YEARS = {
  B: { short: '1st Sec', long: '1st Secondary', ar: 'الصف الأول الثانوي' },
  C: { short: '2nd Sec', long: '2nd Secondary', ar: 'الصف الثاني الثانوي' },
  T: { short: '3rd Sec', long: '3rd Secondary', ar: 'الصف الثالث الثانوي' }
};
const ID_RE = /^[BCT]\d{1,5}$/;

/* ---------- Firebase ---------- */
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);

/* ---------- Helpers ---------- */
const loginView = $('#loginView'), appView = $('#appView');
const sid = $('#sid'), pw = $('#pw'), errBox = $('#loginErr'), loginBtn = $('#loginBtn');
let toastTimer, study = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }
function clearError() { errBox.hidden = true; }

/* ---------- ID input: only a valid ID can be typed ---------- */
function cleanId(v) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[^BCT]+/, '');
  return v ? v[0] + v.slice(1).replace(/\D/g, '').slice(0, 5) : '';
}
function updateIdUI() {
  const l = sid.value[0];
  $$('#idChips span').forEach(c => c.classList.toggle('on', c.dataset.l === l));
  const b = $('#yearBadge');
  if (YEARS[l]) { b.textContent = YEARS[l].short; b.classList.add('on'); } else { b.classList.remove('on'); }
}
function rejectFlash() {
  const box = sid.closest('.inp');
  box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  if (!sid.value) $$('#idChips span').forEach(c => { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 500); });
}
sid.addEventListener('input', () => {
  const raw = sid.value, cleaned = cleanId(raw);
  if (cleaned !== raw.toUpperCase()) rejectFlash();
  sid.value = cleaned; updateIdUI(); clearError();
});
pw.addEventListener('input', clearError);
$('#eyeBtn').addEventListener('click', () => {
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  $('#eyeBtn').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

/* ---------- External links ---------- */
function wireLink(el, url, msg) {
  if (url) { el.href = url; return; }
  el.addEventListener('click', e => { e.preventDefault(); toast(msg); });
}
wireLink($('#newStudentBtn'), SITE.NEW_STUDENT_URL, 'The new-student registration link is not set yet.');
wireLink($('#examsBtn'), SITE.EXAMS_URL, 'The exams link is not set yet.');

/* ---------- Sign in / out ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearError();
  const id = sid.value.trim().toUpperCase(), pass = pw.value;
  if (!ID_RE.test(id)) { showError('Enter your ID: one letter (B, C or T) then numbers. Example: T156'); rejectFlash(); return; }
  if (!pass) { showError('Enter your password.'); return; }
  loginBtn.classList.add('loading');
  try {
    await signInWithEmailAndPassword(auth, `${id.toLowerCase()}@${SITE.EMAIL_DOMAIN}`, pass);
  } catch (err) {
    const c = err.code || '';
    if (c === 'auth/too-many-requests') showError('Too many attempts. Wait a few minutes, then try again.');
    else if (c === 'auth/network-request-failed') showError('No internet connection. Check it and try again.');
    else showError('ID or password is incorrect. Check them, or ask Mr Omar for your password.');
    loginBtn.classList.remove('loading');
  }
});
$('#logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  loginBtn.classList.remove('loading');
  const suffix = '@' + SITE.EMAIL_DOMAIN;
  if (!user) { study && study.dispose(); study = null; appView.hidden = true; loginView.hidden = false; pw.value = ''; return; }
  if (!user.email || !user.email.endsWith(suffix)) {          // e.g. the teacher account
    await signOut(auth);
    showError('This page is for students. Teachers use the teacher link.');
    return;
  }
  const id = user.email.slice(0, -suffix.length).toUpperCase();
  let name = id;
  try {                                                         // the account must exist in the teacher's list and be active
    const snap = await getDoc(doc(db, 'students', id));
    if (!snap.exists() || snap.data().active === false) {
      await signOut(auth);
      showError('Your account is not active. Please contact Mr Omar.');
      return;
    }
    if (snap.data().name) name = snap.data().name;
  } catch {
    await signOut(auth);
    showError('Could not verify your account. Check your internet and try again.');
    return;
  }
  loginView.hidden = true; appView.hidden = false;
  enterApp(id, name);
});

function enterApp(id, name) {
  study && study.dispose();
  study = initStudy({ db, id, name });
  const y = YEARS[id[0]];
  $('#chipId').textContent = id;
  $('#chipYear').textContent = y ? y.short : '';
  $('#helloName').textContent = name;
  showTab(location.hash.slice(1) || 'home', false);
}

/* ---------- Tabs ---------- */
const tabs = $('#tabs'), ink = $('#tabInk');
const TAB_NAMES = $$('.tab').map(t => t.dataset.tab);
function moveInk(btn) {
  ink.style.width = btn.offsetWidth + 'px';
  ink.style.transform = `translateX(${btn.offsetLeft}px)`;
}
function showTab(name, push = true) {
  if (!TAB_NAMES.includes(name)) name = 'home';
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  $$('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + name; });
  tabs.dataset.active = name;
  const btn = $(`.tab[data-tab="${name}"]`);
  requestAnimationFrame(() => {
    moveInk(btn);
    tabs.scrollTo({ left: btn.offsetLeft - (tabs.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
  });
  if (name === 'study' && study) study.open();
  if (push) history.replaceState(null, '', '#' + name);
}
tabs.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });
addEventListener('resize', () => { const b = $('.tab[aria-selected="true"]'); if (b && !appView.hidden) moveInk(b); });
addEventListener('hashchange', () => { if (!appView.hidden) showTab(location.hash.slice(1), false); });
document.fonts && document.fonts.ready.then(() => { const b = $('.tab[aria-selected="true"]'); if (b && !appView.hidden) moveInk(b); });
