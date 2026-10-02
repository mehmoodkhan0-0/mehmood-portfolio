/**
 * cursor.js — Custom blend-mode cursor.
 * A precise dot + a lagging ring that expands with contextual labels
 * over interactive elements. Skipped entirely on touch devices.
 */

let dot, ring, bound;

export function initCursor(mouse) {
  dot = document.querySelector('.cursor-dot');
  ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  // Promote to compositor layer and flag the OS cursor off ONLY after we've
  // proven the custom cursor is alive — if boot ever fails (rare script race,
  // red-motion edge, last-minute extension) the user keeps their system pointer.
  document.documentElement.classList.add('no-os-cursor');

  // Drive position purely via GPU-composited transforms (no left/top = no layout
  // thrash). Promote both layers and zero the CSS offsets we now replace.
  dot.style.willChange = 'transform';
  ring.style.willChange = 'transform';
  dot.style.left = ring.style.left = '0px';
  dot.style.top = ring.style.top = '0px';

  let dx = mouse.x, dy = mouse.y; // dot — near-instant
  let rx = mouse.x, ry = mouse.y; // ring — weighted trail

  // mousemove only records the vector — ALL DOM writes happen once per frame,
  // so high-Hz mice can't flood the main thread with redundant style writes.
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });

  // Single rAF loop: frame-rate-capped writes, translate3d for compositing.
  // The ring uses mix-blend-mode:difference, so EVERY transform write makes the
  // compositor re-blend the page region under it. When the pointer is still, the
  // smoothed values converge and re-writing the same transform was paying that
  // blend cost ~60x/sec for nothing. We now skip the DOM write once a layer is
  // within a sub-pixel epsilon of its last written position (invisible), while
  // the rAF keeps ticking so motion resumes instantly.
  let ldx = null, ldy = null, lrx = null, lry = null;
  const EPS = 0.05;
  (function loop() {
    dx += (mouse.x - dx) * 0.9;   // snappy follow with a hair of smoothing
    dy += (mouse.y - dy) * 0.9;
    rx += (mouse.x - rx) * 0.18;  // weighted trailing ring
    ry += (mouse.y - ry) * 0.18;
    if (ldx === null || Math.abs(dx - ldx) > EPS || Math.abs(dy - ldy) > EPS) {
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      ldx = dx; ldy = dy;
    }
    if (lrx === null || Math.abs(rx - lrx) > EPS || Math.abs(ry - lry) > EPS) {
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      lrx = rx; lry = ry;
    }
    requestAnimationFrame(loop);
  })();

  bound = new WeakSet();
  refreshCursorTargets();
}

/**
 * Re-binds hover targets. Call after injecting dynamic DOM
 * (skill rows, carousel cards, etc.) so new elements get the
 * ring expansion + contextual label behavior.
 */
export function refreshCursorTargets() {
  if (!ring || !bound) return;

  // Interactive elements: ring expands and shows the contextual label.
  document.querySelectorAll('a, button, [data-cursor]').forEach((el) => {
    if (bound.has(el)) return;
    bound.add(el);
    el.addEventListener('mouseenter', () => {
      ring.classList.add('active');
      const txt = ring.querySelector('.ring-txt');
      if (txt) txt.textContent = el.dataset.cursor || '';
    });
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('active');
      const txt = ring.querySelector('.ring-txt');
      if (txt) txt.textContent = '';
    });
  });

  // High-end typographic targets: ring morphs into a filled white inversion
  // lens (no label) so 'difference' blend inverts the text beneath it.
  document.querySelectorAll('h1, h2, .hero-name, .split-chars, .ch').forEach((el) => {
    if (bound.has(el)) return;
    bound.add(el);
    el.addEventListener('mouseenter', () => {
      ring.classList.add('active', 'lens');
      const txt = ring.querySelector('.ring-txt');
      if (txt) txt.textContent = '';
    });
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('active', 'lens');
    });
  });
}

