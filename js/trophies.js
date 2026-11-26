// Physics Arena trophies: catalog, automatic evaluation, artwork and levels. Pure code, no Firebase here.
export const TIERS = {
  bronze:   { label: 'Bronze',   ar: 'برونزي',  pts: 15 },
  silver:   { label: 'Silver',   ar: 'فضي',     pts: 30 },
  gold:     { label: 'Gold',     ar: 'ذهبي',    pts: 90 },
  platinum: { label: 'Platinum', ar: 'بلاتيني', pts: 180 }
};
export const CATS = [
  ['all', 'All', 'الكل'], ['learn', 'Learning', 'التعلّم'], ['streak', 'Consistency', 'الالتزام'], ['marks', 'Performance', 'الأداء'],
  ['rank', 'Ranking', 'الترتيب'], ['rev', 'Revisions', 'المراجعات'], ['special', 'Special', 'خاصة']
];

/* 24x24 line icons used as the emblem on each cup */
export const ICONS = {
  play: '<path d="M9 7v10l8-5z"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h5M10 17h4"/>',
  check: '<path d="m6 12.5 4 4 8-9"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  calendar: '<rect x="5" y="6" width="14" height="14" rx="2"/><path d="M5 10h14M9 4v4M15 4v4"/>',
  star: '<path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  crown: '<path d="m4 8 4 4 4-6 4 6 4-4-2 11H6z"/>',
  bolt: '<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>',
  moon: '<path d="M18 14a7 7 0 1 1-8-9 6 6 0 0 0 8 9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6"/>',
  rewind: '<path d="M11 7 5 12l6 5zM19 7l-6 5 6 5z"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/>',
  chart: '<path d="M4 19h16M7 16v-4M12 16V7M17 16v-6"/>',
  arrow: '<path d="M12 19V6M6 12l6-6 6 6"/>',
  book: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
  rocket: '<path d="M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zM9 16l-2 4 3-1M15 16l2 4-3-1"/><circle cx="12" cy="10" r="1.6"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="m9 3 3 6 3-6M12 12v4"/>',
  cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>'
};

/* ---------------- catalog ---------------- */
// fn(ctx) returns [current, target]; the trophy is unlocked when current >= target.
const bin = ok => [ok ? 1 : 0, 1];
const cnt = (n, t) => [Math.min(n, t), t];
const T = (id, cat, tier, icon, name, ar, desc, fn, hidden = false) => ({ id, cat, tier, icon, name, ar, desc, fn, hidden });

export const CATALOG = [
  /* Learning */
  T('first_login', 'learn', 'bronze', 'rocket', 'First Contact', 'أول دخول', 'Log in to Physics Arena for the first time.', c => bin(c.p.totalDays >= 1)),
  T('first_video', 'learn', 'bronze', 'play', 'Press Play', 'اضغط تشغيل', 'Finish your first lecture video.', c => cnt(c.p.videos, 1)),
  T('videos_10', 'learn', 'silver', 'play', 'Lecture Marathon', 'ماراثون المحاضرات', 'Finish 10 lecture videos.', c => cnt(c.p.videos, 10)),
  T('videos_50', 'learn', 'gold', 'play', 'Video Veteran', 'محارب المحاضرات', 'Finish 50 lecture videos.', c => cnt(c.p.videos, 50)),
  T('week_1', 'learn', 'bronze', 'check', 'Week Complete', 'أسبوع كامل', 'Finish every video of one week.', c => cnt(c.p.weeksDone, 1)),
  T('week_5', 'learn', 'silver', 'book', 'Five Week Run', 'خمسة أسابيع', 'Finish every video in 5 different weeks.', c => cnt(c.p.weeksDone, 5)),
  T('week_all', 'learn', 'gold', 'crown', 'Course Conqueror', 'قاهر المنهج', 'Finish every video of all published weeks (at least 8 weeks).', c => { const t = Math.max(8, c.p.weeksWithVideos); return [Math.min(c.p.weeksDone, t), t]; }),
  T('first_sim', 'learn', 'bronze', 'flask', 'Lab Rat', 'فأر المعمل', 'Open your first simulation.', c => cnt(c.p.sims, 1)),
  T('sims_10', 'learn', 'silver', 'flask', 'Mad Scientist', 'عالم مجنون', 'Open 10 different simulations.', c => cnt(c.p.sims, 10)),
  T('first_file', 'learn', 'bronze', 'file', 'Bookworm', 'دودة كتب', 'Open your first attachment.', c => cnt(c.p.files, 1)),
  T('files_10', 'learn', 'silver', 'file', 'Answer Hunter', 'صائد الإجابات', 'Open 10 attachments.', c => cnt(c.p.files, 10)),
  T('first_assess', 'learn', 'bronze', 'check', 'Homework Starter', 'بداية الواجب', 'Open your first online assignment.', c => cnt(c.p.assess, 1)),
  T('assess_10', 'learn', 'silver', 'target', 'Task Master', 'سيد المهام', 'Open 10 online assignments.', c => cnt(c.p.assess, 10)),
  T('explorer', 'learn', 'silver', 'star', 'Explorer', 'المستكشف', 'Open a lecture, a simulation, an attachment and an assignment.', c => [[c.p.videos, c.p.sims, c.p.files, c.p.assess].filter(n => n > 0).length, 4]),

  /* Consistency */
  T('streak_2', 'streak', 'bronze', 'flame', 'Day Two', 'اليوم الثاني', 'Visit the platform 2 days in a row.', c => cnt(c.p.streak, 2)),
  T('streak_7', 'streak', 'silver', 'flame', 'On a Roll', 'مستمر', 'Visit the platform 7 days in a row.', c => cnt(c.p.streak, 7)),
  T('streak_30', 'streak', 'gold', 'flame', 'Unstoppable', 'لا يُوقَف', 'Visit the platform 30 days in a row.', c => cnt(c.p.streak, 30)),
  T('days_15', 'streak', 'silver', 'calendar', 'Regular', 'منتظم', 'Visit the platform on 15 different days.', c => cnt(c.p.totalDays, 15)),
  T('days_60', 'streak', 'gold', 'calendar', 'Platform Veteran', 'مخضرم المنصة', 'Visit the platform on 60 different days.', c => cnt(c.p.totalDays, 60)),

  /* Performance (from the marks Mr Omar uploads) */
  T('first_marks', 'marks', 'bronze', 'chart', 'First Marks', 'أول درجات', 'Get your first marks on the platform.', c => bin(c.m.has)),
  T('quiz_1', 'marks', 'bronze', 'check', 'Quiz Ace', 'بطل الكويز', 'Score full marks in a quiz.', c => cnt(c.m.perfectQ, 1)),
  T('quiz_5', 'marks', 'silver', 'target', 'Quiz Master', 'سيد الكويز', 'Score full marks in 5 quizzes.', c => cnt(c.m.perfectQ, 5)),
  T('quiz_10', 'marks', 'gold', 'crown', 'Flawless Quizzer', 'كويز بلا أخطاء', 'Score full marks in 10 quizzes.', c => cnt(c.m.perfectQ, 10)),
  T('hw_1', 'marks', 'bronze', 'check', 'Perfect Homework', 'واجب كامل', 'Score full marks in a homework.', c => cnt(c.m.perfectH, 1)),
  T('hw_5', 'marks', 'silver', 'shield', 'Homework Pro', 'محترف الواجب', 'Score full marks in 5 homeworks.', c => cnt(c.m.perfectH, 5)),
  T('hw_10', 'marks', 'gold', 'crown', 'Homework Legend', 'أسطورة الواجب', 'Score full marks in 10 homeworks.', c => cnt(c.m.perfectH, 10)),
  T('prac_1', 'marks', 'bronze', 'target', 'Practice Perfect', 'تدريب كامل', 'Score full marks in a practice.', c => cnt(c.m.perfectP, 1)),
  T('prac_5', 'marks', 'silver', 'bolt', 'Practice Pro', 'محترف التدريب', 'Score full marks in 5 practices.', c => cnt(c.m.perfectP, 5)),
  T('week_perfect', 'marks', 'silver', 'star', 'Perfect Week', 'أسبوع مثالي', 'Full marks in every item of one week.', c => cnt(c.m.perfectWeeks, 1)),
  T('week_perfect_3', 'marks', 'gold', 'star', 'Hat-trick', 'هاتريك', 'Three perfect weeks.', c => cnt(c.m.perfectWeeks, 3)),
  T('attend_chapter', 'marks', 'silver', 'shield', 'Always There', 'حاضر دائمًا', 'Attend every session of a chapter (at least 4 sessions).', c => bin(c.m.fullAttendanceChapter)),
  T('attend_all', 'marks', 'gold', 'shield', 'Iron Attendance', 'حضور حديدي', 'Attend 10 sessions or more without missing a single one.', c => [c.m.absentTotal === 0 ? Math.min(c.m.sessionsTotal, 10) : 0, 10]),
  T('chapter_75', 'marks', 'bronze', 'chart', 'Solid Chapter', 'باب متين', 'Finish a chapter with 75% or more.', c => bin(c.m.bestChapterPct >= 75)),
  T('chapter_90', 'marks', 'silver', 'chart', 'Excellent Chapter', 'باب ممتاز', 'Finish a chapter with 90% or more.', c => bin(c.m.bestChapterPct >= 90)),
  T('chapter_97', 'marks', 'gold', 'crown', 'Flawless Chapter', 'باب بلا عيوب', 'Finish a chapter with 97% or more.', c => bin(c.m.bestChapterPct >= 97)),
  T('overall_85', 'marks', 'silver', 'star', 'Straight A', 'تفوق مستمر', 'Keep an overall average of 85% or more (after at least 3 weeks).', c => bin(c.m.weeksEntered >= 3 && c.m.overallPct >= 85)),
  T('overall_95', 'marks', 'gold', 'crown', 'Distinction', 'امتياز', 'Keep an overall average of 95% or more (after at least 3 weeks).', c => bin(c.m.weeksEntered >= 3 && c.m.overallPct >= 95)),
  T('exam_90', 'marks', 'silver', 'target', 'Exam Ace', 'بطل الامتحان', 'Score 90% or more in an exam.', c => bin(c.m.bestExam >= 90)),
  T('exam_full', 'marks', 'gold', 'crown', 'Perfect Exam', 'امتحان كامل', 'Score full marks in an exam.', c => bin(c.m.perfectExam)),
  T('rev_90', 'marks', 'bronze', 'check', 'Revision Ace', 'بطل المراجعة', 'Score 90% or more in a revision test.', c => bin(c.m.bestRevision >= 90)),
  T('rev_full', 'marks', 'silver', 'target', 'Revision Perfect', 'مراجعة كاملة', 'Score full marks in a revision test.', c => bin(c.m.perfectRevision)),
  T('run_5', 'marks', 'silver', 'flame', 'On Fire', 'مشتعل', 'Score 80% or more in 5 weeks in a row.', c => cnt(c.m.run80, 5)),
  T('comeback', 'marks', 'silver', 'arrow', 'Comeback Kid', 'عودة قوية', 'Improve a week score by 25 points or more over the week before.', c => bin(c.m.comeback)),
  T('star_notes', 'marks', 'silver', 'star', 'Class Star', 'نجم الحصة', 'Earn 5 positive notes from Mr Omar.', c => cnt(c.m.posNotes, 5)),

  /* Ranking */
  T('top10', 'rank', 'bronze', 'medal', 'Top 10', 'ضمن العشرة', 'Reach the top 10 of your year in a chapter.', c => bin(c.m.bestRank <= 10)),
  T('top3', 'rank', 'silver', 'crown', 'On the Podium', 'على المنصة', 'Reach the top 3 of your year in a chapter.', c => bin(c.m.bestRank <= 3)),
  T('top1', 'rank', 'gold', 'crown', 'Number One', 'الأول', 'Rank number 1 in a chapter.', c => bin(c.m.bestRank <= 1)),
  T('overall_1', 'rank', 'gold', 'crown', 'Overall Champion', 'بطل الدفعة', 'Rank number 1 overall in your year.', c => bin(c.m.overallRank === 1 && c.m.overallOf >= 10)),
  T('climb_5', 'rank', 'silver', 'arrow', 'Climber', 'المتسلق', 'Climb 5 places or more from one chapter to the next.', c => bin(c.m.climb >= 5)),

  /* Revisions */
  T('rev_unlock', 'rev', 'bronze', 'rocket', 'Unlocked!', 'تم الفتح', 'Unlock your first paid revision with a code.', c => cnt(c.p.reds, 1)),
  T('rev_3', 'rev', 'silver', 'book', 'Revision Fan', 'عاشق المراجعات', 'Unlock 3 revisions.', c => cnt(c.p.reds, 3)),

  /* Special (some are secret until unlocked) */
  T('parent', 'special', 'bronze', 'heart', 'Family Support', 'دعم الأسرة', 'A parent visited the Parental Portal.', c => bin(c.p.flags.parent)),
  T('night', 'special', 'bronze', 'moon', 'Night Owl', 'بومة الليل', 'Study a lecture after 11 PM.', c => bin(c.p.flags.night), true),
  T('early', 'special', 'bronze', 'sun', 'Early Bird', 'عصفور الصباح', 'Open the platform before 7 AM.', c => bin(c.p.flags.early), true),
  T('speed', 'special', 'bronze', 'bolt', 'Speed Learner', 'متعلم سريع', 'Watch a lecture at double speed.', c => bin(c.p.flags.speed), true),
  T('replay', 'special', 'bronze', 'rewind', 'Rewind', 'إعادة', 'Play a lecture again from the start.', c => bin(c.p.flags.replay), true),
  T('storm', 'special', 'gold', 'bolt', 'Perfect Storm', 'العاصفة المثالية', 'Rank number 1 in a chapter, finish a perfect week and score 90% in an exam.', c => bin(c.m.bestRank <= 1 && c.m.perfectWeeks >= 1 && c.m.bestExam >= 90), true),

  /* Trophy hunter (counts the other trophies) */
  T('hunter_10', 'special', 'bronze', 'cup', 'Trophy Hunter', 'صائد الكؤوس', 'Unlock 10 trophies.', c => cnt(c.count, 10)),
  T('hunter_25', 'special', 'silver', 'cup', 'Trophy Collector', 'جامع الكؤوس', 'Unlock 25 trophies.', c => cnt(c.count, 25)),
  T('hunter_40', 'special', 'gold', 'cup', 'Trophy Master', 'سيد الكؤوس', 'Unlock 40 trophies.', c => cnt(c.count, 40)),
  T('platinum', 'special', 'platinum', 'cup', 'Physics Legend', 'أسطورة الفيزياء', 'Unlock every other trophy.', c => [c.countOthers, c.totalOthers])
];
const META = new Set(['hunter_10', 'hunter_25', 'hunter_40', 'platinum']);

/* ---------------- statistics ---------------- */
export function marksStats(m) {
  const s = { has: false, perfectQ: 0, perfectH: 0, perfectP: 0, perfectWeeks: 0, weeksEntered: 0, sessionsTotal: 0, absentTotal: 0, fullAttendanceChapter: false,
    bestChapterPct: 0, bestRank: Infinity, bestExam: -1, perfectExam: false, bestRevision: -1, perfectRevision: false, run80: 0, comeback: false, climb: 0, posNotes: 0,
    overallPct: 0, overallRank: 0, overallOf: 0 };
  if (!m) return s;
  const full = x => x && x.v !== null && x.max > 0 && x.v >= x.max;
  const seq = []; let prev = null;
  (m.chapters || []).forEach(c => {
    if (c.earned > 0) s.has = true;
    (c.weeks || []).forEach(w => {
      s.sessionsTotal++;
      if (w.att === 'absent') { s.absentTotal++; seq.push({ absent: true, pct: 0 }); return; }
      const items = ['q', 'h', 'p'].map(k => w[k]).filter(Boolean), entered = items.filter(x => x.v !== null);
      if (entered.length) s.weeksEntered++;
      if (full(w.q)) s.perfectQ++; if (full(w.h)) s.perfectH++; if (full(w.p)) s.perfectP++;
      if (items.length && items.every(full)) s.perfectWeeks++;
      seq.push({ pct: entered.length && w.max > 0 ? w.earned / w.max * 100 : null });
    });
    if (c.earned > 0) {
      s.bestChapterPct = Math.max(s.bestChapterPct, c.percent || 0);
      if (c.of >= 5) s.bestRank = Math.min(s.bestRank, c.rank);
      if ((c.present || 0) + (c.absent || 0) >= 4 && c.absent === 0) s.fullAttendanceChapter = true;
      if (prev && prev.earned > 0 && prev.of >= 5) s.climb = Math.max(s.climb, prev.rank - c.rank);
    }
    (c.extras || []).forEach(e => {
      if (e.v === null || !e.max) return;
      const p = e.v / e.max * 100;
      if (e.type === 'exam') { s.bestExam = Math.max(s.bestExam, p); if (e.v >= e.max) s.perfectExam = true; }
      else { s.bestRevision = Math.max(s.bestRevision, p); if (e.v >= e.max) s.perfectRevision = true; }
    });
    prev = c;
  });
  let run = 0, last = null;
  seq.forEach(x => {
    if (x.pct === null) return;
    run = x.pct >= 80 ? run + 1 : 0; s.run80 = Math.max(s.run80, run);
    if (last !== null && x.pct - last >= 25) s.comeback = true;
    last = x.pct;
  });
  s.posNotes = (m.notes || []).reduce((a, n) => a + ((n.pos || []).length), 0);
  const o = m.overall || {};
  s.overallPct = o.percent || 0; s.overallRank = o.rank || 0; s.overallOf = o.of || 0;
  return s;
}

const dayNum = d => { const [y, mo, da] = d.split('-').map(Number); return Math.round(Date.UTC(y, mo - 1, da) / 864e5); };
export function progressStats(p, weeks, reds) {
  const vids = p.videos || {}, done = id => vids[id] && vids[id].done;
  const days = [...new Set(p.loginDays || [])].map(dayNum).sort((a, b) => a - b);
  let streak = 0, run = 0;
  days.forEach((d, i) => { run = i && d === days[i - 1] + 1 ? run + 1 : 1; streak = Math.max(streak, run); });
  let weeksWithVideos = 0, weeksDone = 0;
  (weeks || []).filter(w => w.visible !== false).forEach(w => {
    const items = (w.lessons || []).flatMap(l => (l.items || []).filter(i => i.type === 'video'));
    if (!items.length) return;
    weeksWithVideos++; if (items.every(i => done(i.id))) weeksDone++;
  });
  return {
    videos: Object.values(vids).filter(v => v.done).length,
    sims: Object.keys((p.opened || {}).sim || {}).length, files: Object.keys((p.opened || {}).file || {}).length, assess: Object.keys((p.opened || {}).assess || {}).length,
    weeksDone, weeksWithVideos, streak, totalDays: days.length, flags: p.flags || {},
    reds: new Set((reds || []).map(r => r.revId)).size
  };
}

/* ---------------- evaluation ---------------- */
export function evaluate({ marks, progress, weeks, reds }) {
  const ctx = { m: marksStats(marks), p: progressStats(progress || {}, weeks, reds), count: 0, countOthers: 0, totalOthers: 0 };
  const res = new Map();
  CATALOG.filter(t => !META.has(t.id)).forEach(t => { const [cur, max] = t.fn(ctx); res.set(t.id, { cur, max, done: cur >= max }); });
  ctx.count = [...res.values()].filter(r => r.done).length;
  CATALOG.filter(t => META.has(t.id) && t.id !== 'platinum').forEach(t => { const [cur, max] = t.fn(ctx); res.set(t.id, { cur, max, done: cur >= max }); });
  const others = CATALOG.filter(t => t.id !== 'platinum');
  ctx.totalOthers = others.length; ctx.countOthers = others.filter(t => res.get(t.id).done).length;
  const [cur, max] = CATALOG.find(t => t.id === 'platinum').fn(ctx);
  res.set('platinum', { cur, max, done: cur >= max });
  return res;
}

/* ---------------- levels ---------------- */
export function levelInfo(points) {
  const need = L => 25 * L * (L - 1);                      // points needed to reach level L
  let L = 1; while (points >= need(L + 1)) L++;
  const from = need(L), to = need(L + 1);
  const title = L >= 9 ? 'Legend' : L >= 7 ? 'Master' : L >= 5 ? 'Expert' : L >= 3 ? 'Challenger' : 'Rookie';
  const ar = L >= 9 ? 'أسطورة' : L >= 7 ? 'ماستر' : L >= 5 ? 'خبير' : L >= 3 ? 'متحدٍّ' : 'مبتدئ';
  return { level: L, title, ar, pct: Math.round((points - from) / (to - from) * 100), toNext: to - points };
}
export function summarize(unlockedIds) {
  const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 }; let points = 0;
  CATALOG.forEach(t => { if (unlockedIds.has(t.id)) { counts[t.tier]++; points += TIERS[t.tier].pts; } });
  const totalPoints = CATALOG.reduce((a, t) => a + TIERS[t.tier].pts, 0);
  return { counts, points, totalPoints, done: unlockedIds.size, total: CATALOG.length, ...levelInfo(points) };
}

/* ---------------- artwork ---------------- */
export function trophySVG(tier, icon, state) {                // state: 'on' | 'off' | 'secret'
  const g = { bronze: 'tg-bronze', silver: 'tg-silver', gold: 'tg-gold', platinum: 'tg-plat' }[tier];
  const emb = state === 'secret' ? ICONS.lock : ICONS[icon];
  return `<svg class="tro ${state} ${tier}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M19 12h-8v3a9 9 0 0 0 9 9M45 12h8v3a9 9 0 0 1-9 9" fill="none" stroke="url(#${g})" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M18 6h28v18a14 14 0 0 1-28 0z" fill="url(#${g})"/>
    <rect x="29" y="38" width="6" height="9" fill="url(#${g})"/>
    <path d="M20 58h24l-2.5-11h-19z" fill="url(#${g})"/>
    <path class="gloss" d="M22 9h6v17a14 14 0 0 1-6-10z" fill="#fff" opacity=".38"/>
    <g transform="translate(23 10) scale(.75)" fill="none" stroke="rgba(10,13,43,.8)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${emb}</g>
  </svg>`;
}
