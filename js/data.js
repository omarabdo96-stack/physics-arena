import { doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Small shared cache so Home, Achievements and the Parental Portal do not read the same documents again and again.
export function createData({ db, id }) {
  const yearKey = id[0], cache = {};
  async function once(key, loader, ttl = 3 * 60 * 1000, force = false) {
    const c = cache[key];
    if (!force && c && Date.now() - c.at < ttl) return c.v;
    const v = await loader(); cache[key] = { v, at: Date.now() }; return v;
  }
  const one = async (col, key) => { const s = await getDoc(doc(db, col, key)); return s.exists() ? s.data() : null; };
  return {
    marks: f => once('marks', () => one('marks', id), undefined, f),
    content: f => once('content', async () => (await one('content', yearKey) || { weeks: [] }).weeks || [], undefined, f),
    news: f => once('news', async () => (await one('announcements', yearKey) || { items: [] }).items || [], undefined, f),
    catalog: f => once('catalog', async () => await one('revisions_public', yearKey) || { items: [] }, undefined, f),
    trophies: f => once('trophies', async () => (await one('trophies', id) || { unlocked: {} }), undefined, f),
    reds: f => once('reds', async () => {
      const rs = await getDocs(query(collection(db, 'redemptions'), where('id', '==', id)));
      return rs.docs.map(d => d.data());
    }, undefined, f),
    set(key, v) { cache[key] = { v, at: Date.now() }; },
    drop(key) { delete cache[key]; }
  };
}
