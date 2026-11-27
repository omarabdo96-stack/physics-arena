// Physics Arena background: many small, soft spheres in logo colours drifting at different depths.
// Near the cursor they are gently pushed aside (never pulled together), so nothing clumps, flashes or strains the eyes.
(() => {
  const cv = document.getElementById('bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['91,110,225', '62,76,167', '255,98,144', '227,228,250', '138,99,240'];
  const rand = (a, b) => a + Math.random() * (b - a);
  let W, H, DPR, bodies = [], dust = [], last = 0, raf = 0;
  const ptr = { x: -9999, y: -9999, on: false, gx: -9999, gy: -9999 };
  const PUSH_R = 150;                                          // how far the cursor's gentle push reaches

  function init() {
    const small = W < 700;
    bodies = Array.from({ length: small ? 28 : 70 }, () => {
      const depth = rand(.35, 1);                              // small = far away = slower
      return {
        x: rand(0, W), y: rand(0, H), depth,
        r: 2.5 + Math.pow(Math.random(), 1.9) * 11 * depth,    // mostly tiny, a few bigger
        vx: rand(-.1, .1) * depth, vy: rand(-.1, .1) * depth,
        ph: rand(0, 6.28), c: COLORS[(Math.random() * COLORS.length) | 0], a: rand(.2, .5)
      };
    });
    dust = Array.from({ length: small ? 30 : 70 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-.1, .1), vy: rand(-.2, -.04), r: rand(.7, 1.7), a: rand(.25, .7) }));
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    init();
    if (reduce) draw();
  }

  function step(dt, t) {
    const k = dt * .06;
    if (ptr.on) { ptr.gx += (ptr.x - ptr.gx) * .12; ptr.gy += (ptr.y - ptr.gy) * .12; }
    for (const b of bodies) {
      b.vx += Math.cos(t / 4200 + b.ph) * .0016 * k;          // slow floating wobble
      b.vy += Math.sin(t / 5100 + b.ph) * .0016 * k;
      if (ptr.on) {
        const dx = b.x - ptr.x, dy = b.y - ptr.y, d = Math.hypot(dx, dy);
        if (d < PUSH_R && d > 0.1) {
          const f = (1 - d / PUSH_R), push = f * f * .09 * b.depth * k;   // soft, eased push
          b.vx += dx / d * push; b.vy += dy / d * push;
        }
      }
      b.vx *= .985; b.vy *= .985;
      const sp = Math.hypot(b.vx, b.vy), max = .55;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      b.x += b.vx * k * 16; b.y += b.vy * k * 16;
      const m = b.r + 4;
      if (b.x < -m) b.x = W + m; else if (b.x > W + m) b.x = -m;
      if (b.y < -m) b.y = H + m; else if (b.y > H + m) b.y = -m;
    }
    for (const p of dust) {
      p.x += p.vx * k * 16; p.y += p.vy * k * 16;
      if (p.y < -5) { p.y = H + 5; p.x = rand(0, W); }
      if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (ptr.on) {                                              // a very faint, smooth glow that follows the cursor
      const g = ctx.createRadialGradient(ptr.gx, ptr.gy, 0, ptr.gx, ptr.gy, 130);
      g.addColorStop(0, 'rgba(91,110,225,.10)'); g.addColorStop(1, 'rgba(91,110,225,0)');
      ctx.fillStyle = g; ctx.fillRect(ptr.gx - 130, ptr.gy - 130, 260, 260);
    }
    for (const b of bodies) {
      const g = ctx.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, b.r * .1, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.c},${b.a})`);
      g.addColorStop(1, `rgba(${b.c},${b.a * .15})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
    }
    ctx.lineWidth = .6;
    for (let i = 0; i < dust.length; i++) {
      const p = dust[i];
      ctx.fillStyle = `rgba(227,228,250,${p.a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      for (let j = i + 1; j < dust.length; j++) {
        const q = dust[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
        if (d < 7000) { ctx.strokeStyle = `rgba(138,150,255,${(1 - d / 7000) * .14})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
    }
  }

  function loop(t) {
    const dt = Math.min(50, t - last || 16); last = t;
    step(dt, t); draw();
    raf = requestAnimationFrame(loop);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', e => {
    if (!ptr.on) { ptr.gx = e.clientX; ptr.gy = e.clientY; }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.on = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce) { last = 0; raf = requestAnimationFrame(loop); }
  });
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
})();
