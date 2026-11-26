import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Records what the student does on the platform (videos finished, items opened, visiting days).
// Saved in progress/{ID}. Used by the trophies and by the parent's activity summary.
export function createTracker({ db, id }) {
  let p = { videos: {}, opened: { sim: {}, file: {}, assess: {} }, loginDays: [], flags: {} };
  const listeners = new Set();
  const ref = doc(db, 'progress', id);
  const notify = () => listeners.forEach(f => { try { f(p); } catch { /* ignore */ } });

  async function save(partial) {
    try { await setDoc(ref, { ...partial, updatedAtMs: Date.now() }, { merge: true }); } catch { /* offline: progress is best effort */ }
  }
  async function load() {
    try {
      const s = await getDoc(ref);
      if (s.exists()) {
        const d = s.data();
        p = { videos: d.videos || {}, opened: { sim: {}, file: {}, assess: {}, ...(d.opened || {}) }, loginDays: d.loginDays || [], flags: d.flags || {} };
      }
    } catch { /* keep defaults */ }
    const t = today();
    if (!p.loginDays.includes(t)) { p.loginDays = [...p.loginDays, t].slice(-300); await save({ loginDays: p.loginDays }); }
    if (new Date().getHours() < 7) flag('early');
    notify();
    return p;
  }
  function flag(name) {
    if (p.flags[name]) return;
    p.flags[name] = Date.now(); save({ flags: { [name]: p.flags[name] } }); notify();
  }
  function opened(it) {
    if (!it || !it.id) return;
    if (it.type === 'video') { const h = new Date().getHours(); if (h >= 23 || h < 4) flag('night'); return; }
    const bucket = p.opened[it.type]; if (!bucket || bucket[it.id]) return;
    bucket[it.id] = Date.now(); save({ opened: { [it.type]: { [it.id]: bucket[it.id] } } }); notify();
  }
  function videoDone(it) {
    if (!it || !it.id || (p.videos[it.id] && p.videos[it.id].done)) return;
    p.videos[it.id] = { done: true, at: Date.now() };
    save({ videos: { [it.id]: p.videos[it.id] } }); notify();
  }
  return {
    load, flag, opened, videoDone,
    get data() { return p; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    dispose() { listeners.clear(); }
  };
}
