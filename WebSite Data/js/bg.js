// Physics Arena background: logo-coloured spheres drifting under a soft "gravity" pulled by the pointer.
(() => {
  const cv = document.getElementById('bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['91,110,225', '62,76,167', '255,98,144', '227,228,250', '138,99,240'];
  const rand = (a, b) => a + Math.random() * (b - a);
  let W, H, DPR, bodies = [], dust = [], last = 0, raf = 0;
  const ptr = { x: -9999, y: -9999, on: false };

  function init() {
    const small = W < 700;
    bodies = Array.from({ length: small ? 9 : 20 }, () => {
      const r = rand(10, small ? 44 : 72);
      return { x: rand(0, W), y: rand(0, H), r, vx: rand(-.2, .2), vy: rand(-.2, .2), c: COLORS[(Math.random() * COLORS.length) | 0], a: rand(.14, .42) };
    });
    dust = Array.from({ length: small ? 34 : 80 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-.12, .12), vy: rand(-.25, -.04), r: rand(.8, 2.1), a: rand(.25, .8) }));
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    init();
    if (reduce) draw(0);
  }

  function step(dt) {
    for (const b of bodies) {
      if (ptr.on) {
        const dx = ptr.x - b.x, dy = ptr.y - b.y, d2 = dx * dx + dy * dy + 2500;
        const f = 9000 / d2;                       // inverse-square pull
        b.vx += (dx / Math.sqrt(d2)) * f * dt * .06;
        b.vy += (dy / Math.sqrt(d2)) * f * dt * .06;
      }
      b.vx *= .995; b.vy *= .995;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1.4) { b.vx *= 1.4 / sp; b.vy *= 1.4 / sp; }
      b.x += b.vx * dt * .06 * 16; b.y += b.vy * dt * .06 * 16;
      const m = b.r;
      if (b.x < -m) b.x = W + m; else if (b.x > W + m) b.x = -m;
      if (b.y < -m) b.y = H + m; else if (b.y > H + m) b.y = -m;
    }
    for (const p of dust) {
      p.x += p.vx * dt * .06 * 16; p.y += p.vy * dt * .06 * 16;
      if (p.y < -5) { p.y = H + 5; p.x = rand(0, W); }
      if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bodies) {
      const g = ctx.createRadialGradient(b.x - b.r * .35, b.y - b.r * .35, b.r * .1, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.c},${b.a})`);
      g.addColorStop(1, `rgba(${b.c},${b.a * .12})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
    }
    ctx.lineWidth = .7;
    for (let i = 0; i < dust.length; i++) {
      const p = dust[i];
      ctx.fillStyle = `rgba(227,228,250,${p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      for (let j = i + 1; j < dust.length; j++) {
        const q = dust[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
        if (d < 8100) { ctx.strokeStyle = `rgba(138,150,255,${(1 - d / 8100) * .22})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
      if (ptr.on) {
        const dx = p.x - ptr.x, dy = p.y - ptr.y, d = dx * dx + dy * dy;
        if (d < 19600) { ctx.strokeStyle = `rgba(255,98,144,${(1 - d / 19600) * .5})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); }
      }
    }
  }

  function loop(t) {
    const dt = Math.min(50, t - last || 16); last = t;
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; }, { passive: true });
  addEventListener('pointerleave', () => { ptr.on = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) { last = 0; raf = requestAnimationFrame(loop); }
  });
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
})();
