// Shared by the teacher dashboard and the student page.
export const TYPES = {
  video:  { label: 'Lecture video', ar: 'محاضرة', group: 'Lectures',    groupAr: 'المحاضرات' },
  sim:    { label: 'Simulation',    ar: 'محاكاة', group: 'Simulation',  groupAr: 'المحاكاة' },
  file:   { label: 'Attachment',    ar: 'مرفق',   group: 'Attachments', groupAr: 'المرفقات' },
  assess: { label: 'Assessment',    ar: 'تقييم',  group: 'Assessments', groupAr: 'التقييمات' }
};
export const TYPE_ORDER = ['video', 'sim', 'file', 'assess'];
export const uid = () => Math.random().toString(36).slice(2, 9);

export function parseYouTube(u) {
  try {
    const x = new URL(u.trim()); let id = '';
    if (x.hostname.includes('youtu.be')) id = x.pathname.slice(1).split('/')[0];
    else if (x.hostname.includes('youtube.com')) {
      id = x.searchParams.get('v') || '';
      if (!id) { const m = x.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return /^[\w-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}

export function parseDrive(u) {
  try {
    const x = new URL(u.trim());
    if (x.hostname === 'drive.google.com') {
      if (/\/drive\/folders\//.test(x.pathname)) return { error: 'Folders cannot be shown inside the platform. Share the file itself.' };
      const m = x.pathname.match(/\/file\/d\/([\w-]+)/), id = m ? m[1] : x.searchParams.get('id');
      if (id && /^[\w-]+$/.test(id)) return { embed: `https://drive.google.com/file/d/${id}/preview` };
    }
    if (x.hostname === 'docs.google.com') {
      const m = x.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
      if (m) return { embed: `https://docs.google.com/${m[1]}/d/${m[2]}/preview` };
    }
  } catch { /* fall through */ }
  return { error: 'This does not look like a Google Drive or Google Docs link.' };
}

export function httpsUrl(u) {
  try { const x = new URL(u.trim()); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; }
}

// Turns what the teacher typed into a stored item, or an error message.
export function buildItem(type, title, url, id) {
  title = (title || '').trim(); url = (url || '').trim();
  if (!title) return { error: 'Enter a title.' };
  if (!url) return { error: 'Paste the link.' };
  let ref = '';
  if (type === 'video') { ref = parseYouTube(url); if (!ref) return { error: 'This does not look like a YouTube link.' }; }
  else if (type === 'file') { const r = parseDrive(url); if (r.error) return { error: r.error }; ref = r.embed; }
  else { ref = httpsUrl(url); if (!ref) return { error: 'The link must start with https://' }; }
  return { item: { id: id || uid(), type, title, ref } };
}
