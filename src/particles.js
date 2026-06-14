/**
 * particles.js — Ambient 3D-feel particle field on a single 2D canvas.
 *
 * - Microscopic SOFT ROUND dust (drawn with arc(), never fillRect).
 * - Gentle upward drift + horizontal sine sway, slow twinkle (opacity cycle).
 * - Click spawns a short-lived radial shockwave burst.
 * - One requestAnimationFrame loop, clearRect each frame.
 * - Resize is handled without wiping the running ambient array.
 * - Fully isolated: no GSAP / ScrollTrigger / Lenis usage, so it cannot
 *   interfere with the #ops pinned layout.
 */

const COLORS = ['#ffbd59', '#d4af37', '#ff003c'];
const TWO_PI = Math.PI * 2;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function initParticles() {
  const canvas = document.getElementById('ambient-particle-canvas');
  if (!canvas) return;

  // Respect reduced-motion and skip on tiny/touch to keep it light.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    // NOTE: ambient array is NOT reset here — particles keep floating.
  }
  resize();

  // Scale count with viewport area, clamped to the requested 600–1000 range.
  const ambientCount = Math.max(600, Math.min(1000, Math.round((W * H) / 1700)));

  // edge: 'bottom' (default) spawns just below the viewport drifting up;
  // 'top' spawns just above it (used when an up-scroll warp pushes dust down,
  // so recycled particles re-enter from the top instead of stacking at the bottom).
  function makeParticle(seed, edge) {
    const fromTop = edge === 'top';
    return {
      x: Math.random() * W,
      y: seed
        ? Math.random() * H
        : fromTop ? -Math.random() * 40 : H + Math.random() * 40,
      r: rand(0.4, 1.2),
      vy: -rand(0.03, 0.12),          // gentle upward drift
      sway: rand(0.2, 0.8),           // horizontal sine amplitude
      swaySpeed: rand(0.0004, 0.0012),
      phase: Math.random() * TWO_PI,  // sway phase
      color: pick(COLORS),
      twBase: rand(0.25, 0.7),        // base opacity
      twAmp: rand(0.15, 0.35),        // twinkle amplitude
      twSpeed: rand(0.0024, 0.0075),  // faster, sharper twinkle (~3x)
      twPhase: Math.random() * TWO_PI
    };
  }

  const ambient = Array.from({ length: ambientCount }, () => makeParticle(true));
  const burst = [];

  // ---- Click burst: 25–35 round particles, fast out, decelerate + fade ~0.5s ----
  window.addEventListener('click', (e) => {
    const n = 25 + ((Math.random() * 11) | 0); // 25–35
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TWO_PI;
      const speed = rand(2.2, 5.5);
      burst.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: rand(0.6, 1.4),
        color: pick(COLORS),
        life: 1,                    // 1 -> 0
        decay: rand(0.04, 0.07)     // ~0.5s at 60fps
      });
    }
  }, { passive: true });

  // ---- Reactive scroll velocity (passive, never blocks the GSAP/Lenis pins) ----
  // scrollBoost is a transient multiplier added to upward drift while the user
  // scrolls, then eased back to 0 so particles settle to their calm float speed.
  let lastScrollY = window.scrollY || window.pageYOffset || 0;
  let scrollVelocity = 0; // raw px/event, signed (down = positive)
  let scrollBoost = 0;    // smoothed warp factor applied in the loop

  window.addEventListener('scroll', () => {
    const y = window.scrollY || window.pageYOffset || 0;
    // delta > 0 when scrolling DOWN -> push particles UP faster (warp fly-through)
    scrollVelocity = y - lastScrollY;
    lastScrollY = y;
    // Feed velocity into the boost, clamped so a flick can't fling them off-screen.
    scrollBoost += scrollVelocity * 0.05;
    if (scrollBoost > 18) scrollBoost = 18;
    if (scrollBoost < -18) scrollBoost = -18;
  }, { passive: true });

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(2.5, (now - last) / 16.67); // frame-rate independent
    last = now;

    ctx.clearRect(0, 0, W, H);

    // Ease the scroll warp boost back toward 0 every frame so the field calms
    // down smoothly the instant scrolling stops (back to 0.03-0.12 drift).
    scrollBoost *= Math.pow(0.82, dt);
    if (Math.abs(scrollBoost) < 0.001) scrollBoost = 0;

    // ---- Ambient dust ----
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.phase += p.swaySpeed * (now);
      // Base calm drift + transient scroll warp. Scrolling DOWN (boost > 0)
      // shifts particles UP rapidly; scrolling UP reverses it.
      p.y += (p.vy - scrollBoost) * dt;
      const x = p.x + Math.sin(now * p.swaySpeed + p.phase) * p.sway;

      // recycle when it leaves the viewport. Re-enter from the OPPOSITE edge to
      // the one it exited so bidirectional scroll warps never clip or gather
      // particles at a boundary: off the top -> respawn at bottom, and vice versa.
      if (p.y < -2) {
        ambient[i] = makeParticle(false, 'bottom');
        continue;
      }
      if (p.y > H + 4) {
        ambient[i] = makeParticle(false, 'top');
        continue;
      }

      const tw = p.twBase + Math.sin(now * p.twSpeed + p.twPhase) * p.twAmp;
      ctx.globalAlpha = tw < 0 ? 0 : tw > 1 ? 1 : tw;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, TWO_PI);
      // High-end glowing aura layer
      ctx.shadowBlur = p.r * 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.fill();
      // Reset shadowBlur immediately so it never lags the next frame clear
      ctx.shadowBlur = 0;
    }

    // ---- Click burst ----
    for (let i = burst.length - 1; i >= 0; i--) {
      const b = burst[i];
      b.vx *= 0.9;   // rapid deceleration
      b.vy *= 0.9;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= b.decay * dt;
      if (b.life <= 0) {
        burst.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = b.life;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * b.life, 0, TWO_PI); // shrink as it fades
      // Matching neon glow on the burst sparks
      ctx.shadowBlur = b.r * 6;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', resize, { passive: true });
}
