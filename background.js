/* =====================================================================
   Animated background engine
   Modes: "network" (connected particles), "stars" (warp speed),
          "waves" (flowing sine waves), "photo" (floating bokeh over photo)
   Exposes window.Background.setMode(mode) / .setAccent(hex)
   ===================================================================== */
(() => {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = reduceMotion ? 0.25 : 1;

  let W = 0, H = 0, t = 0;
  let mode = "network";
  let accent = [0, 224, 255];
  const mouse = { x: -9999, y: -9999 };

  let particles = [], stars = [], bokeh = [];

  const rand = (a, b) => a + Math.random() * (b - a);
  const rgba = (a, c = accent) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- setup ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  function newStar(z = rand(1, W)) {
    return { x: rand(-W, W), y: rand(-H, H), z };
  }

  function newBokeh(bottom = false) {
    const r = rand(20, 90);
    return {
      x: rand(0, W),
      y: bottom ? H + r : rand(0, H),
      r,
      s: rand(0.15, 0.6),
      a: rand(0.05, 0.22),
      o: rand(0, Math.PI * 2),
    };
  }

  function init() {
    const count = Math.round(Math.min(150, (W * H) / 11000));
    particles = Array.from({ length: count }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-0.35, 0.35),
      vy: rand(-0.35, 0.35),
      r: rand(0.8, 2.2),
    }));
    stars = Array.from({ length: 450 }, () => newStar());
    bokeh = Array.from({ length: 35 }, () => newBokeh());
  }

  /* ---------- mode: network ---------- */
  function drawNetwork() {
    ctx.clearRect(0, 0, W, H);
    const LINK = 130, LINK2 = LINK * LINK, REPEL = 120;

    for (const p of particles) {
      p.x += p.vx * SPEED;
      p.y += p.vy * SPEED;
      if (p.x < 0 || p.x > W) { p.vx *= -1; p.x = Math.max(0, Math.min(W, p.x)); }
      if (p.y < 0 || p.y > H) { p.vy *= -1; p.y = Math.max(0, Math.min(H, p.y)); }

      // Particles gently flee the mouse
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < REPEL * REPEL && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = ((REPEL - d) / REPEL) * 1.6;
        p.x += (dx / d) * f;
        p.y += (dy / d) * f;
      }
    }

    // Links between nearby particles
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          ctx.strokeStyle = rgba((1 - d2 / LINK2) * 0.35);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Links to the mouse
      const mx = a.x - mouse.x, my = a.y - mouse.y;
      const m2 = mx * mx + my * my;
      if (m2 < 200 * 200) {
        ctx.strokeStyle = `rgba(255,255,255,${(1 - m2 / 40000) * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    // Dots
    ctx.fillStyle = rgba(0.9);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- mode: warp stars ---------- */
  function drawStars() {
    ctx.clearRect(0, 0, W, H);
    const speed = 7 * SPEED;
    const focal = W * 0.5;
    // Mouse steers the vanishing point slightly
    const cx = W / 2 + (mouse.x > -1 ? (mouse.x - W / 2) * 0.08 : 0);
    const cy = H / 2 + (mouse.y > -1 ? (mouse.y - H / 2) * 0.08 : 0);

    ctx.lineCap = "round";
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const prevZ = s.z + speed * 4;
      s.z -= speed;
      if (s.z < 1) { stars[i] = newStar(W); continue; }

      const x = (s.x / s.z) * focal + cx;
      const y = (s.y / s.z) * focal + cy;
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) { stars[i] = newStar(W); continue; }
      const px = (s.x / prevZ) * focal + cx;
      const py = (s.y / prevZ) * focal + cy;

      const k = 1 - s.z / W; // 0 far → 1 near
      ctx.strokeStyle = i % 3 === 0 ? rgba(k) : `rgba(255,255,255,${k})`;
      ctx.lineWidth = k * 2.6 + 0.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  /* ---------- mode: waves ---------- */
  function drawWaves() {
    ctx.clearRect(0, 0, W, H);
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const amp = 26 + i * 12;
      const base = H * (0.42 + i * 0.085);
      const sp = 0.5 + i * 0.12;
      const pts = [];
      for (let x = -10; x <= W + 20; x += 12) {
        let y = base
          + Math.sin(x * 0.0032 + t * sp + i) * amp
          + Math.sin(x * 0.0091 - t * sp * 1.4 + i * 1.7) * amp * 0.35;
        // Waves swell under the cursor
        const dx = x - mouse.x;
        y -= Math.exp(-(dx * dx) / 18000) * 40 * (mouse.y > -1 ? 1 : 0);
        pts.push([x, y]);
      }

      ctx.beginPath();
      ctx.moveTo(pts[0][0], H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(pts[pts.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = rgba(0.035 + i * 0.018);
      ctx.fill();

      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = rgba(0.2 + i * 0.09);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ---------- mode: photo (bokeh lights) ---------- */
  function drawBokeh() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < bokeh.length; i++) {
      const b = bokeh[i];
      b.y -= b.s * SPEED;
      b.x += Math.sin(t * 0.6 + b.o) * 0.3;
      if (b.y < -b.r) { bokeh[i] = newBokeh(true); continue; }
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(b.a));
      g.addColorStop(0.6, rgba(b.a * 0.4));
      g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const drawers = { network: drawNetwork, stars: drawStars, waves: drawWaves, photo: drawBokeh };

  function loop() {
    t += 0.016 * SPEED;
    (drawers[mode] || drawNetwork)();
    requestAnimationFrame(loop);
  }

  /* ---------- events ---------- */
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  addEventListener("blur", () => { mouse.x = mouse.y = -9999; });

  window.Background = {
    setMode(m) {
      mode = drawers[m] ? m : "network";
      document.body.dataset.bg = mode;
      ctx.clearRect(0, 0, W, H);
    },
    setAccent(hex) { accent = hexToRgb(hex); },
  };

  resize();
  loop();
})();
