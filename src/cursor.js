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

  let rx = mouse.x;
  let ry = mouse.y;

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
  });

  // The ring trails the dot with a lerp for a weighted, expensive feel.
  (function loop() {
    rx += (mouse.x - rx) * 0.16;
    ry += (mouse.y - ry) * 0.16;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
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
