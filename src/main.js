/**
 * main.js — Application entry.
 * Orchestrates: smooth scroll, preloader, cursor, dynamic section rendering from
 * the data layer, the lazily-mounted Sentinel 3D island, and all scroll
 * choreography.
 */
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { skills, certs, timeline } from './data.js';
import { initCursor, refreshCursorTargets } from './cursor.js';
import { runPreloader } from './preloader.js';

gsap.registerPlugin(ScrollTrigger);

/* ====================================================
   TWISTING RIBBON — FIXED hero backdrop (React island).
   A vibrant Canvas-2D ribbon (molten ember face, amber/gold/jade folds) waving
   and twisting behind the hero masthead. The host is position:fixed and lives
   OUTSIDE .skew-wrap (see index.html), so the ribbon holds dead still in the
   viewport while the page scrolls over it — it belongs to the hero, not to the
   scroll flow. GSAP owns its opacity: a one-shot fade-up on boot, then a
   scrubbed dissolve across the hero exit (see SCROLL CHOREOGRAPHY) so it never
   ghosts behind the sections below. Boots as a lazy chunk (react-dom downloads
   in parallel while the preloader plays), and the island unmounts the rAF loop
   whenever the hero scrolls off-screen.
==================================================== */
import('./heroRibbonIsland.jsx')
  .then(({ initHeroRibbon }) => {
    initHeroRibbon();
    // Intro fade-up. CSS parks the host at opacity:0 and deliberately does NOT
    // animate it — a keyframe would out-rank the scrub's inline style later.
    // Under reduced motion the reveal system already set it visible outright.
    if (!reduceMotion) {
      gsap.to('.hero-ribbon-bg', { opacity: 1, duration: 1.6, ease: 'power2.out', delay: 0.35 });
    }
  })
  .catch((err) => console.warn('[ribbon] hero background failed to boot:', err));

/* pointer:coarse catches iPads with desktop UA (width ≥ 1024) that the old
   width+UA sniff misclassified as desktop — they got a frozen blend-mode ring. */
const isMobile = window.innerWidth < 769
  || /Mobi|Android/i.test(navigator.userAgent)
  || window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };

/* ====================================================
   SMOOTH SCROLL (Lenis + ScrollTrigger sync)
==================================================== */
const lenis = new Lenis({
  duration: 1.25,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

function bindAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a.dataset.boundAnchor) return;
    a.dataset.boundAnchor = '1';
    a.addEventListener('click', (e) => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) {
        e.preventDefault();
        closeMenu();
        lenis.scrollTo(t, { offset: -60 });
      }
    });
  });
}

/* ====================================================
   HERO — char splitting + reveal
==================================================== */
document.querySelectorAll('.split-chars').forEach((el) => {
  el.innerHTML = [...el.textContent]
    .map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('');
});

function heroReveal() {
  /* Reduced motion: the hero copy is parked at translateY(120%) behind an
     overflow mask by CSS, and the HUD at clip-path inset(0 100% 0 0). Those are
     initial STATES, not animations, so the global reduced-motion CSS rule can
     never resolve them — something has to put them at rest explicitly. The
     preloader skips straight to this path, so it runs immediately on boot. */
  if (reduceMotion) {
    gsap.set('#hero .ch, #hero .mask-line>span', { y: 0, opacity: 1 });
    gsap.set('.system-hud', { clipPath: 'inset(0 0% 0 0)' });
    return;
  }

  gsap.to('#hero .ch', { y: 0, duration: 1.2, stagger: 0.045, ease: 'expo.out' });
  gsap.to('#hero .mask-line>span:not(.split-chars)', {
    y: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out', delay: 0.15
  });
  gsap.from('nav, .hero-cta .btn, .badge', {
    y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.3
  });
  // Cinematic clip-path scan-in for the System Intel HUD, sequenced into the
  // existing hero reveal (no competing timeline).
  gsap.to('.system-hud', {
    clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power3.inOut', delay: 0.55
  });
}

runPreloader(heroReveal);

/* ====================================================
   CURSOR + MAGNETIC BUTTONS (desktop only)
==================================================== */
if (!isMobile) {
  initCursor(mouse);

  document.querySelectorAll('.magnetic').forEach((btn) => {
    // Reading getBoundingClientRect() on every mousemove forced a synchronous
    // layout reflow per frame per button. Measure ONCE on enter and reuse it for
    // the whole hover. The elastic mouseleave return runs 0.7s, so a quick
    // re-enter can catch the button mid-flight — subtract the live transform to
    // recover the true untransformed box (no lurch on re-entry).
    let r = null;
    btn.addEventListener('mouseenter', () => {
      const b = btn.getBoundingClientRect();
      const cx = Number(gsap.getProperty(btn, 'x')) || 0;
      const cy = Number(gsap.getProperty(btn, 'y')) || 0;
      r = { left: b.left - cx, top: b.top - cy, width: b.width, height: b.height };
    });
    btn.addEventListener('mousemove', (e) => {
      if (!r) r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(btn, { x: dx * 0.3, y: dy * 0.3, duration: 0.4 });
    });
    btn.addEventListener('mouseleave', () => {
      r = null;
      gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,.4)' });
    });
  });
} else {
  // Loaded small, resized big: the ≥769px CSS re-hides the OS cursor but the
  // custom one was never initialised — the user would have NO visible pointer.
  let cursorInited = false;
  window.addEventListener('resize', () => {
    if (!cursorInited && innerWidth >= 769 && matchMedia('(pointer: fine)').matches) {
      cursorInited = true;
      initCursor(mouse);
      refreshCursorTargets();
    }
  }, { passive: true });
}

/* ====================================================
   AGENCY-TIER MICRO-INTERACTIONS
   NOTE: invoked AFTER dynamic sections render (see initMicroInteractions()
   call further down), because .cert-card is injected from the data layer and
   does not exist at this point in the file. A WeakSet keeps the binding
   idempotent in case it is ever called again.
==================================================== */
const microBound = new WeakSet();

function initMicroInteractions() {
  // 3D gyro-tilt (desktop only) — gentle, max 2deg, mouse-anchored.
  // One reused quickTo setter per card.
  if (!isMobile) {
    // .feedback-card is gone: the final prompt is no longer a card, it sits
    // free on the page, so there is nothing there left to tilt.
    document.querySelectorAll('.hero-glass').forEach((card) => {
      if (microBound.has(card)) return;
      microBound.add(card);
      const setRX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
      const setRY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });
      card.style.transformPerspective = '900px';
      card.style.transformStyle = 'preserve-3d';
      // Cache the rect on enter instead of reading it every mousemove (each read
      // forces a layout reflow). The ±2° tilt makes a rest-measured rect
      // indistinguishable from a live one.
      let cr = null;
      card.addEventListener('mouseenter', () => { cr = card.getBoundingClientRect(); });
      card.addEventListener('mousemove', (e) => {
        if (!cr) cr = card.getBoundingClientRect();
        const px = (e.clientX - cr.left) / cr.width - 0.5;  // -0.5 .. 0.5
        const py = (e.clientY - cr.top) / cr.height - 0.5;
        setRY(px * 4);        // max ~2deg each side
        setRX(-py * 4);
        // the crystal's light pool (.glass-glow) reads these
        card.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('mouseleave', () => { cr = null; setRX(0); setRY(0); });
    });
  }

  // Voltage feedback — 0.1s brightness/glow spike on click via CSS class toggle.
  // (.cert-card intentionally excluded: the dossier panels carry their own
  // hover tilt written through CSS custom properties, and an extra filter or
  // transform on the same element fights it.)
  document.querySelectorAll('.btn').forEach((el) => {
    if (microBound.has(el)) return;
    microBound.add(el);
    el.addEventListener('click', () => {
      el.classList.add('voltage');
      setTimeout(() => el.classList.remove('voltage'), 100);
    }, { passive: true });
  });
}

/* ====================================================
   FULLSCREEN MENU
==================================================== */
const burger = document.getElementById('burger');
const overlay = document.getElementById('menuOverlay');
let menuOpen = false;

function openMenu() {
  menuOpen = true;
  overlay.classList.add('open');
  burger.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
  gsap.fromTo('.menu-overlay .m-link',
    { y: 80, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.07, duration: 0.8, ease: 'expo.out', delay: 0.15 });
  gsap.fromTo('.menu-overlay .menu-foot a',
    { y: 24, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: 'expo.out', delay: 0.5 });
  lenis.stop();
  const first = overlay.querySelector('.m-link');
  if (first) first.focus({ preventScroll: true });
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  overlay.classList.remove('open');
  burger.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  lenis.start();
  burger.focus({ preventScroll: true });
}

if (burger) {
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

/* ====================================================
   DYNAMIC SECTIONS — rendered from the data layer
==================================================== */

/* HUD visor marquee — cosine-dip curve + seamless, single-textPath loop */
const visorSvg = document.getElementById('visorSvg');
if (visorSvg) {
  const host      = visorSvg.parentElement;          // .hud-visor
  const visorPath = document.getElementById('visorPath');
  const visorTop  = document.getElementById('visorTop');
  const visorBot  = document.getElementById('visorBottom');
  const visorText = document.getElementById('visorText');
  const loop      = visorText.querySelector('animate');
  const PHRASES   = 4;                                // hardcoded copies in the SVG

  const layoutVisor = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;

    // 1:1 pixel viewBox so the curve never stretches weirdly on resize / mobile
    visorSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // COSINE DIP \u2014 two chained cubic Beziers, all tangents horizontal:
    // flat (left edge) -> dip (centre) -> flat (right edge). Control handles sit
    // at the quarter / three-quarter points so dy/dx = 0 at start, bottom & end.
    const top = h * 0.31;          // straight baseline at both edges (raised slightly)
    const bot = h * 0.69;          // bottom of the centre dip (~19% deeper, still clear of edges)
    const d =
      `M0,${top} ` +
      `C${w * 0.25},${top} ${w * 0.25},${bot} ${w / 2},${bot} ` +
      `C${w * 0.75},${bot} ${w * 0.75},${top} ${w},${top}`;
    visorPath.setAttribute('d', d);

    // parallel curved borders, offset above / below the text baseline
    const gap = Math.max(40, h * 0.17);
    visorTop.setAttribute('transform', `translate(0,${-gap})`);
    visorBot.setAttribute('transform', `translate(0,${gap})`);

    // ZERO-OVERLAP loop: shift startOffset by EXACTLY one phrase so the tiling
    // is perfect regardless of font metrics. Falls back to the SVG's -50% if the
    // browser cannot measure the text yet. beginElement() restarts the loop from
    // zero, so only fire it when the timing actually changed — otherwise every
    // resize (incl. mobile URL-bar collapse) visibly snapped the band back.
    const pathLen = visorPath.getTotalLength();
    const phrase  = visorText.getComputedTextLength() / PHRASES;
    if (phrase > 0 && pathLen > 0) {
      const to = `-${((phrase / pathLen) * 100).toFixed(3)}%`;
      const dur = `${Math.max(18, phrase / 70).toFixed(1)}s`;
      if (to !== loop.getAttribute('to') || dur !== loop.getAttribute('dur')) {
        loop.setAttribute('to', to);
        loop.setAttribute('dur', dur);
        try { loop.beginElement(); } catch (e) { /* SMIL not ready - keep running */ }
      }
    }
  };

  layoutVisor();
  // debounced: layoutVisor forces SVG text metrics (expensive layout) — dozens
  // of raw resize events fire per second during a window drag.
  let visorRz;
  window.addEventListener('resize', () => {
    clearTimeout(visorRz);
    visorRz = setTimeout(layoutVisor, 150);
  }, { passive: true });
  // text metrics depend on the web font \u2014 recompute once it has finished loading
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutVisor);

  // The marquee is a never-ending SMIL animation mutating an SVG attribute every
  // frame for the WHOLE page lifetime \u2014 it kept running long after the visor
  // scrolled away. Pause the SVG's animation clock while it's off-screen; the
  // band is decorative (aria-hidden) and transparent over black, so freezing it
  // is invisible. Resumes seamlessly from where it paused on re-entry.
  if ('IntersectionObserver' in window && typeof visorSvg.pauseAnimations === 'function') {
    let smilPaused = false;
    new IntersectionObserver((entries) => {
      const vis = entries.some((e) => e.isIntersecting);
      if (vis && smilPaused) { visorSvg.unpauseAnimations(); smilPaused = false; }
      else if (!vis && !smilPaused) { visorSvg.pauseAnimations(); smilPaused = true; }
    }, { rootMargin: '120px 0px' }).observe(host);
  }
}

/* journey timeline — items alternate a shallow/deep dot lane so the rail
   below has something to weave between (the docs-nav serpentine read) */
const tlItemsEl = document.getElementById('tlItems');
if (tlItemsEl) {
  tlItemsEl.innerHTML = timeline.map((t, i) => `
  <div class="tl-item${i % 2 ? ' tl-item--indent' : ''}">
    <span class="tl-dot"></span>
    <div class="tl-marker">${t.marker}</div>
    <div class="tl-body"><h3>${t.title}</h3><p>${t.text}</p></div>
  </div>`).join('');
}

/* ── JOURNEY RAIL — serpentine scroll-progress track (section 02) ──
   The old straight .tl-line (a bare scaleY stroke shooting through the dots)
   is gone. An SVG path now weaves through the alternating dot lanes with
   rounded elbows — a designed TRACK, like a docs "on this page" rail. A dim
   base stroke draws the full route; a gilded gradient stroke COVERS it in
   sync with scroll (dashoffset scrub), and a comet head rides the path,
   igniting each dot as it passes. Geometry is measured from the real DOM
   (offset* chain — transform-immune, so mid-reveal tweens can't skew it) and
   rebuilt on every ScrollTrigger refresh (covers resize + font swaps). */
const tlTrack = document.getElementById('tlTrack');
if (tlTrack && tlItemsEl) {
  const tlWrap = document.querySelector('.timeline');
  const tlBase = tlTrack.querySelector('.tl-track-base');
  const tlFill = tlTrack.querySelector('.tl-track-fill');
  const tlComet = tlTrack.querySelector('.tl-comet');
  const tlDots = [...tlWrap.querySelectorAll('.tl-dot')];

  let tlLen = 0;
  let tlPts = [];

  const buildTrack = () => {
    if (!tlDots.length) return;
    const h = tlWrap.offsetHeight;
    tlTrack.setAttribute('viewBox', `0 0 64 ${h}`);
    tlTrack.style.height = `${h}px`;
    // dot centres via the offsetParent chain (.tl-item is the dot's offset
    // parent; .timeline is the item's) — immune to in-flight reveal transforms
    tlPts = tlDots.map((dot) => {
      const item = dot.closest('.tl-item');
      return {
        x: item.offsetLeft + dot.offsetLeft + dot.offsetWidth / 2,
        y: item.offsetTop + dot.offsetTop + dot.offsetHeight / 2,
      };
    });
    const R = 16;                       // elbow radius of the rounded steps
    let d = `M ${tlPts[0].x} 0 L ${tlPts[0].x} ${tlPts[0].y}`;
    for (let i = 1; i < tlPts.length; i++) {
      const a = tlPts[i - 1];
      const b = tlPts[i];
      if (Math.abs(b.x - a.x) < 1) { d += ` L ${b.x} ${b.y}`; continue; }
      const ym = (a.y + b.y) / 2;       // swerve lanes midway between the dots
      const s = b.x > a.x ? 1 : -1;
      d += ` L ${a.x} ${ym - R} Q ${a.x} ${ym} ${a.x + R * s} ${ym}`
         + ` L ${b.x - R * s} ${ym} Q ${b.x} ${ym} ${b.x} ${ym + R}`
         + ` L ${b.x} ${b.y}`;
    }
    d += ` L ${tlPts[tlPts.length - 1].x} ${h}`;
    tlBase.setAttribute('d', d);
    tlFill.setAttribute('d', d);
    tlLen = tlFill.getTotalLength();
    tlFill.style.strokeDasharray = `${tlLen}`;
  };

  const paintTrack = (p) => {
    if (!tlLen) return;
    tlFill.style.strokeDashoffset = `${tlLen * (1 - p)}`;
    const pt = tlFill.getPointAtLength(tlLen * p);
    tlComet.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    tlComet.setAttribute('opacity', p > 0.001 && p < 0.999 ? '1' : '0');
    // a dot ignites the moment the beam reaches its rung
    for (let i = 0; i < tlDots.length; i++) {
      tlDots[i].classList.toggle('lit', pt.y >= (tlPts[i]?.y ?? Infinity) - 6);
    }
  };

  buildTrack();
  if (reduceMotion) {
    paintTrack(1);                      // full route shown, all dots lit
  } else {
    const prog = { p: 0 };
    gsap.to(prog, {
      p: 1, ease: 'none',
      onUpdate: () => paintTrack(prog.p),
      scrollTrigger: {
        trigger: tlWrap, start: 'top 68%', end: 'bottom 58%',
        scrub: 0.5, invalidateOnRefresh: true,
      },
    });
    // refresh fires on resize/orientation and after ScrollTrigger recalcs —
    // re-measure the route and repaint at the current progress
    ScrollTrigger.addEventListener('refresh', () => { buildTrack(); paintTrack(prog.p); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { buildTrack(); paintTrack(prog.p); });
    }
  }
}

/* skills index list */
const skillListEl = document.getElementById('skillList');
if (skillListEl) {
  skillListEl.innerHTML = skills.map((s, i) => `
  <div class="skill-row" style="--lv:${s.level}%" data-cursor="${s.level}%">
    <span class="idx">0${i + 1}</span>
    <div class="stack">
      <span class="name">${s.name}</span>
      <span class="desc">${s.desc}</span>
    </div>
    <span class="pct">${s.level}%</span>
    <span class="wipe"></span><span class="bar"></span>
  </div>`).join('');
}

/* THE SENTINEL — Revealing-Hero 3D Data-Core (section 04).
   Mounted as a React island (R3F + drei + postprocessing) into #sentinelRoot.
   The dynamic import previously fired at module eval, so the ~334KB-gzip
   React/R3F/three chunk downloaded and parsed DURING initial load anyway —
   the island's IO only deferred the mount, not the network/parse cost. Now the
   import itself waits until #matrix is within 600px of the viewport, so first
   paint ships zero React. Once imported, the island freezes/resumes its own
   render loop (it no longer destroys the WebGL context on every scroll pass). */
const sentinelHost = document.getElementById('sentinelRoot');
if (sentinelHost) {
  const bootSentinel = () =>
    import('./skillMatrix3DIsland.jsx').then(({ initSkillMatrix3D }) => initSkillMatrix3D());
  const matrixSec = document.getElementById('matrix') || sentinelHost;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        bootSentinel();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(matrixSec);
  } else {
    bootSentinel();
  }
}

/* ═══ VERIFIED RECORD — SCROLL-DRIVEN LEDGER (section 05) ═══
   Third rebuild, and the drag rail is GONE. The deck was a horizontal
   scroll-snap carousel with a 1:1 mouse-drag handler layered on top of native
   snap: the two fought every frame, releasing a drag re-snapped with a second
   animation, and the depth ladder (is-active/is-near/is-far) meant the card you
   were reaching for was dimmed and desaturated until it arrived. Nothing about
   it read premium, and the transition between cards was the worst part.

   The records are now a plain vertical <ol> in normal page flow. There is no
   snapping, no scroll hijack, no pointer-driven browsing and no nav chrome — you
   scroll the page and each record unfolds on arrival: the image un-veils behind
   a transform-only curtain while it settles out of a 9% overscale, then the
   dossier panel rises and its rows cascade in. Records alternate sides so the
   column reads as an editorial spread rather than six copies of one template.

   Motion discipline (matches the EDITORIAL REVEAL SYSTEM below):
     - transform + opacity ONLY. The curtain is a scaleY'd panel, not an animated
       clip-path, so the whole reveal stays on the compositor.
     - CSS parks the armed state via .cert--armed and GSAP animates TO rest, so a
       ScrollTrigger refresh can never re-hide a record that already played.
     - under prefers-reduced-motion nothing is armed at all: every record is at
       rest in its final state from first paint.
     - `once:true` — a record plays exactly once, so scrubbing back up the page
       never replays six timelines at the same time. */
const recordsEl = document.getElementById('records');
if (recordsEl) {
  const total = certs.length;
  // padStart, not a hardcoded '0' prefix: the old markup broke past nine records
  const pad = (n) => String(n).padStart(2, '0');

  /* Records are <li> inside an <ol> — a numbered sequence is exactly what this
     is, and it is the pattern assistive tech already understands. The old markup
     announced a "carousel" of unlabelled slides with arrow-key instructions that
     no longer apply to anything. */
  recordsEl.innerHTML = certs.map((c, i) => {
    /* width/height are REAL attributes, not CSS-only sizing: the browser reserves
       the exact box (and knows the true ratio) before the image decodes, so the
       frame never has to guess, the record never shifts on load, and ScrollTrigger
       measures a stable page height on first pass. Part of the crispness fix — the
       old markup let a soft, ratio-mismatched bitmap be scaled into whatever box
       the grid happened to hand it. */
    const media = c.image
      ? `<img src="${c.image}" alt="${c.imageAlt}"
              width="${c.imageW}" height="${c.imageH}"
              loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"
              fetchpriority="${i === 0 ? 'high' : 'auto'}">`
      : `<div class="cert-visual-mark" aria-hidden="true"><span>${c.visual}</span><small>${c.credential}</small></div>`;

    const action = c.href
      ? `<a class="cert-action" href="${c.href}" target="_blank" rel="noreferrer">${c.action || 'View credential'} <span aria-hidden="true">↗</span></a>`
      : `<span class="cert-action cert-action--static">${c.action || c.credential}</span>`;

    /* --ratio cuts the frame to THIS certificate's own proportions instead of
       forcing every scan into one shared box. That is the other half of the
       crispness fix: with the frame matching the source, the bitmap maps into a
       box it was never stretched to fill and nothing has to resample it. */
    const ratio = c.imageW && c.imageH ? (c.imageW / c.imageH).toFixed(4) : '1.44';

    return `
  <li class="cert${c.featured ? ' cert--featured' : ''}${i % 2 ? ' cert--flip' : ''}"
      style="--ratio:${ratio}">
    <article class="cert-showcase" aria-labelledby="record-title-${i}">
      <figure class="cert-media">
        <div class="cert-plate">
          <div class="cert-media-inner">${media}</div>
          <span class="cert-media-shade" aria-hidden="true"></span>
          <span class="cert-media-frame" aria-hidden="true"></span>
          <span class="cert-media-veil" aria-hidden="true"></span>
        </div>
        <figcaption>
          <span class="cert-media-kind">${c.kind}</span>
          <span class="cert-media-index" aria-hidden="true">${pad(i + 1)}</span>
        </figcaption>
      </figure>

      <div class="cert-panel">
        <div class="cert-card">
          <span class="cert-rail" aria-hidden="true"></span>
          <span class="cert-scan" aria-hidden="true"></span>
          <span class="cert-corner cert-corner--tl" aria-hidden="true"></span>
          <span class="cert-corner cert-corner--br" aria-hidden="true"></span>
          <div class="cert-card-body">
            <header class="cert-top cert-row">
              <span class="cert-classification">VERIFIED RECORD</span>
              <span class="cert-index">${pad(i + 1)} / ${pad(total)}</span>
            </header>
            <div class="cert-heading cert-row">
              <p class="cert-issuer" style="--issuer:${c.accent || 'var(--champagne)'}">
                <span class="cert-issuer-dot" aria-hidden="true"></span>
                <span class="cert-issuer-tag"><i aria-hidden="true">[</i>${c.issuer || c.org}<i aria-hidden="true">]</i></span>
              </p>
              <h3 class="cert-title" id="record-title-${i}">${c.title}</h3>
            </div>
            <p class="cert-detail cert-row">${c.detail}</p>
            <dl class="cert-meta cert-row">
              <div><dt>Record</dt><dd>${c.meta}</dd></div>
              <div><dt>Reference</dt><dd>${c.credential}</dd></div>
            </dl>
            <div class="cert-foot cert-row">
              <span class="cert-status"><i aria-hidden="true"></i>AUTHENTICATED</span>
              ${action}
            </div>
          </div>
          <span class="cert-sheen" aria-hidden="true"></span>
          <span class="cert-glare" aria-hidden="true"></span>
        </div>
      </div>
    </article>
  </li>`;
  }).join('');

  const records = [...recordsEl.querySelectorAll('.cert')];
  const railFill = document.getElementById('recordsRailFill');

  /* ---- scroll reveal ---------------------------------------------------
     One timeline per record, triggered by that record's own position. Nothing
     is scroll-JACKED: the page scrolls at its natural rate and the timelines
     play on arrival, which is why there is no snapping left to feel. */
  if (reduceMotion) {
    // nothing was ever armed, so there is nothing to un-hide — just fill the rail
    if (railFill) railFill.style.transform = 'scaleY(1)';
  } else {
    records.forEach((rec) => rec.classList.add('cert--armed'));

    records.forEach((rec) => {
      const inner = rec.querySelector('.cert-media-inner');
      const veil = rec.querySelector('.cert-media-veil');
      const panel = rec.querySelector('.cert-panel');
      const caption = rec.querySelector('.cert-media figcaption');
      const rows = rec.querySelectorAll('.cert-row');

      gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
          trigger: rec,
          // 82% keeps the reveal comfortably inside the viewport: the record has
          // committed to being on screen before it starts, so a fast flick never
          // shows a half-played curtain parked mid-frame.
          start: 'top 82%',
          once: true,
          invalidateOnRefresh: true
        },
        onComplete: () => rec.classList.remove('cert--armed')   // drops will-change
      })
        /* Timing pass. The first cut paired expo.inOut on the curtain with
           expo.out on the plate, and instrumenting it showed both were wrong:
           expo.inOut idles near 1.0 then dumps ~0.73 -> 0.10 in a couple of
           frames, which is a snap wearing an easing curve's name, and expo.out
           is so front-loaded that the plate had already settled to 1.009 while
           the curtain still covered a quarter of it — the entire settle was
           spent behind a closed veil where nobody could see it.

           So: power2.inOut spreads the wipe evenly across its full 1.25s, and
           the plate now settles on a near-linear power1.out over 2.1s, which
           leaves it still ~1% oversized as the curtain clears and lets the last
           of the drift play in the open. The reveal reads as one continuous
           gesture instead of a wipe followed by a static image. */
        .to(veil, { scaleY: 0, duration: 1.25, ease: 'power2.inOut' }, 0)
        .to(inner, { scale: 1, duration: 2.1, ease: 'power1.out' }, 0.06)
        .to(caption, { y: 0, opacity: 1, duration: 0.85 }, 0.72)
        .to(panel, { y: 0, opacity: 1, duration: 1.15 }, 0.26)
        .to(rows, { y: 0, opacity: 1, duration: 0.85, stagger: 0.08 }, 0.44);

      /* depth: the dossier drifts a hair against its image across the pass. Tiny
         amplitude, scrub-smoothed, transform-only — it reads as parallax rather
         than as movement. GSAP composes yPercent with the reveal's y on the same
         element, so the two never fight. */
      if (!isMobile) {
        gsap.fromTo(panel,
          { yPercent: -1.8 },
          {
            yPercent: 1.8, ease: 'none',
            scrollTrigger: {
              trigger: rec, start: 'top bottom', end: 'bottom top', scrub: 0.6
            }
          });
      }
    });

    /* the gilded rail beside the ledger IS the progress indicator now — it
       replaces the dots/count/arrows, and it can only be driven by scroll */
    if (railFill) {
      gsap.fromTo(railFill,
        { scaleY: 0 },
        {
          scaleY: 1, ease: 'none',
          scrollTrigger: {
            trigger: recordsEl, start: 'top 72%', end: 'bottom 78%', scrub: 0.4
          }
        });
    }
  }

  /* ---- live gating -----------------------------------------------------
     The scan pass and the rail glow are infinite CSS loops. Six of them running
     at once for the whole session is exactly the waste the .anim-off observer
     exists to prevent, so a record only goes "live" while it is on screen. */
  if ('IntersectionObserver' in window) {
    const liveIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting));
    }, { rootMargin: '12% 0px' });
    records.forEach((rec) => liveIO.observe(rec));
  } else {
    records.forEach((rec) => rec.classList.add('is-live'));
  }

  /* ---- tilt + cursor optics -------------------------------------------
     Hover only, and no longer gated on a "centred" card — every record is fully
     lit now, so any panel under the cursor responds. This is the ONLY pointer
     handler left in the section: there is no pointerdown, no pointer capture and
     no scrollLeft write anywhere, which is what "no drag remains" actually means.
     ONE delegated listener for the whole ledger; the rect is cached per hover
     because reading it on every move forces a layout reflow. */
  if (!isMobile && !reduceMotion) {
    let hot = null;
    let hotRect = null;

    const resetTilt = () => {
      if (!hot) return;
      hot.classList.remove('is-hot');
      hot.style.setProperty('--tilt-x', '0deg');
      hot.style.setProperty('--tilt-y', '0deg');
      hot = null;
      hotRect = null;
    };

    recordsEl.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const card = e.target.closest ? e.target.closest('.cert-card') : null;
      if (!card) { resetTilt(); return; }
      if (card !== hot) {
        resetTilt();
        hot = card;
        card.classList.add('is-hot');
      }
      if (!hotRect) hotRect = card.getBoundingClientRect();

      const px = (e.clientX - hotRect.left) / hotRect.width;
      const py = (e.clientY - hotRect.top) / hotRect.height;
      card.style.setProperty('--tilt-y', `${((0.5 - px) * 7).toFixed(2)}deg`);
      card.style.setProperty('--tilt-x', `${((py - 0.5) * 7).toFixed(2)}deg`);
      // the sheen and glare gradients read these same two custom properties
      card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    });

    recordsEl.addEventListener('pointerleave', resetTilt);
    // the hovered panel slides under a stationary cursor while the page scrolls,
    // so the cached rect must be dropped; the next move re-measures exactly once
    window.addEventListener('scroll', () => { hotRect = null; }, { passive: true });
    window.addEventListener('resize', () => { hotRect = null; }, { passive: true });
  }
}

/* ANIMATED FOOTER \u2014 the closing ASCII statement (React island).
   Same lazy discipline as the Sentinel: the chunk is not even fetched until
   #animatedFooterRoot is within 800px of the viewport, so first paint ships
   nothing for it. Once imported, the island mounts/unmounts itself to keep the
   twin canvas rAF loops idle while you are anywhere else on the page. */
const footerHost = document.getElementById('animatedFooterRoot');
if (footerHost) {
  const bootFooter = () =>
    import('./animatedFooterIsland.jsx')
      .then(({ initAnimatedFooter }) => initAnimatedFooter())
      .catch((err) => console.warn('[footer] animated footer failed to boot:', err));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        bootFooter();
      }
    }, { rootMargin: '800px 0px' });
    io.observe(footerHost);
  } else {
    bootFooter();
  }
}

/* ====================================================
   EDITORIAL TEXT SPLITTING \u2014 display heads + the about lede are atomised
   BEFORE cursor targets bind, so every new .ch span also gets the inversion
   lens. Section heads reuse the hero's char voice; the lede splits into word
   tokens (keeping the <em> intact as one token) for a staggered rise.
==================================================== */
document.querySelectorAll('.sec-head').forEach((el) => {
  el.innerHTML = [...el.textContent]
    .map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('');
});

const ledeEl = document.querySelector('.about-lede');
if (ledeEl) {
  const tokens = [];
  ledeEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { tokens.push(document.createTextNode(' ')); return; }
        const s = document.createElement('span');
        s.className = 'wd';
        s.textContent = w;
        tokens.push(s);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const s = document.createElement('span');
      s.className = 'wd';
      s.appendChild(node.cloneNode(true));
      tokens.push(s);
    }
  });
  ledeEl.replaceChildren(...tokens);
}

/* dynamic DOM is in place — (re)bind cursor targets, anchors, micro-interactions */
if (!isMobile) refreshCursorTargets();
bindAnchors();
initMicroInteractions();

/* ====================================================
   SCROLL CHOREOGRAPHY
==================================================== */

/* nav shrink + progress bar.
   `.shrunk` morphs the right-aligned links into the centred glass pill — fire it
   once the user has scrolled past most of the hero rather than at a fixed 80px.
   Element refs + the scroll range are cached so the per-scroll handler (Lenis
   fires it a LOT) never re-queries the DOM or reads scrollHeight — reading
   scrollHeight inside a scroll handler forces a layout reflow every tick. */
const navEl = document.getElementById('nav');
const pbarEl = document.getElementById('pbar');
let maxScroll = 1;
let shrunkOn = false;
function recomputeScrollRange() {
  maxScroll = Math.max(1, document.body.scrollHeight - innerHeight);
}
recomputeScrollRange();
window.addEventListener('resize', recomputeScrollRange, { passive: true });
window.addEventListener('load', recomputeScrollRange, { passive: true });
ScrollTrigger.addEventListener('refresh', recomputeScrollRange);

/* Lenis fires scroll far more often than once per frame, so every write here is
   coalesced into a single rAF: the DOM is touched at most once per frame no
   matter how many events arrive. The progress bar is revealed with clip-path
   (paint) instead of an animated width (layout on every single tick). */
let scrollQueued = false;

function onScrollFrame() {
  scrollQueued = false;
  const y = scrollY;
  const shouldShrink = y > innerHeight * 0.6;
  if (shouldShrink !== shrunkOn && navEl) {        // only touch classList on change
    shrunkOn = shouldShrink;
    navEl.classList.toggle('shrunk', shouldShrink);
  }
  if (pbarEl) {
    const pct = Math.min(100, Math.max(0, (y / maxScroll) * 100));
    pbarEl.style.clipPath = `inset(0 ${(100 - pct).toFixed(2)}% 0 0)`;
  }
}

window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(onScrollFrame);
}, { passive: true });

/* ====================================================
   EDITORIAL REVEAL SYSTEM — every component enters like a printed page coming
   to life: char-masked display heads (the hero's voice, everywhere), a
   word-staggered lede, depth fly-ins for structural blocks, cell/chip/CTA
   staggers, dot pops, an iris-in for the HUD visor, and slow scrub parallax
   for cinematic depth. Discipline:
     - transform/opacity only (compositor-cheap); the single clip-path iris is
       a one-shot entrance, same budget as the hero HUD scan-in.
     - immediateRender:false everywhere → a ScrollTrigger refresh (every
       resize) can never re-hide already-revealed content.
     - under prefers-reduced-motion the WHOLE system is skipped and every
       CSS-masked initial state is force-set to rest, so nothing is hidden.
==================================================== */
if (reduceMotion) {
  gsap.set('.ch, .mask-line>span', { y: 0 });
  gsap.set('.system-hud', { clipPath: 'inset(0 0% 0 0)' });
  // The whole reveal system (incl. the ribbon's boot fade + exit scrub) is
  // skipped below, and CSS parks the backdrop at opacity:0 — show it outright
  // so the hero still has its ground.
  gsap.set('.hero-ribbon-bg', { opacity: 1 });
} else {
  /* display heads — char-masked rise inside the .sec-head overflow mask */
  document.querySelectorAll('.sec-head').forEach((head) => {
    gsap.to(head.querySelectorAll('.ch'), {
      y: 0, duration: 1.15, stagger: 0.032, ease: 'expo.out',
      scrollTrigger: { trigger: head, start: 'top 86%', invalidateOnRefresh: true }
    });
  });

  /* about lede — word-by-word editorial rise (em token rides along) */
  gsap.from('.about-lede .wd', {
    yPercent: 62, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.02,
    immediateRender: false,
    scrollTrigger: { trigger: '.about-lede', start: 'top 86%', invalidateOnRefresh: true }
  });

  /* structural depth fly-ins — containers only; their inner elements get the
     dedicated staggers below instead of a second, competing tween.
     .carousel-shell is deliberately absent: the Verified Record ledger reveals
     per-record on its own trigger (see section 05 above), and a container-level
     rotationX fly-in on top of that would double-animate every card. */
  document.querySelectorAll(
    'section:not(#hero) .sec-label, .skill-row, .tl-item'
  ).forEach((el) => {
    gsap.from(el, {
      y: 90, rotationX: -35, opacity: 0,
      transformPerspective: 800, transformOrigin: 'center bottom',
      duration: 1.1, ease: 'power3.out',
      // immediateRender:false → never slam the element to opacity:0 at creation.
      // The from-state is applied only when the trigger first fires, so a
      // ScrollTrigger refresh (every resize) can't re-hide already-revealed
      // sections without re-firing their enter event. Kept as refresh-safety.
      immediateRender: false,
      scrollTrigger: { trigger: el, start: 'top 88%', invalidateOnRefresh: true }
    });
  });

  /* soft risers — body copy + section hint captions */
  document.querySelectorAll('.rev, .matrix-hint').forEach((el, i) => {
    gsap.from(el, {
      y: 40, opacity: 0, duration: 0.9, delay: i * 0.1,
      immediateRender: false,
      scrollTrigger: { trigger: el, start: 'top 90%', invalidateOnRefresh: true }
    });
  });

  /* the Sentinel stage rises flat — no perspective fly-in. A rotated ancestor
     over a live WebGL canvas resamples every frame of the boot through a
     mid-flight matrix, which is what made the section look like it stuttered.
     clearProps leaves the stage with NO residual transform once it lands. */
  gsap.from('.sentinel-stage', {
    y: 70, opacity: 0, duration: 1.2, ease: 'power3.out',
    immediateRender: false, clearProps: 'transform',
    scrollTrigger: { trigger: '.sentinel-stage', start: 'top 88%', invalidateOnRefresh: true }
  });

  /* identity chips — staggered pop with a hint of spring */
  gsap.from('.chips .chip', {
    y: 26, opacity: 0, scale: 0.92, duration: 0.8, ease: 'back.out(1.7)',
    stagger: 0.07, immediateRender: false,
    scrollTrigger: { trigger: '.chips', start: 'top 90%', invalidateOnRefresh: true }
  });

  /* timeline — the serpentine rail owns its own scroll scrub (see JOURNEY
     RAIL above); here the dots still pop as their item lands */
  document.querySelectorAll('.tl-dot').forEach((dot) => {
    gsap.from(dot, {
      scale: 0, duration: 0.7, ease: 'back.out(2.6)', immediateRender: false,
      scrollTrigger: {
        trigger: dot.closest('.tl-item') || dot, start: 'top 85%',
        invalidateOnRefresh: true
      }
    });
  });

  /* intel report — the bordered frame lands first, cells cascade into it */
  gsap.from('#statsPanel .stat', {
    y: 70, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.09,
    immediateRender: false,
    scrollTrigger: { trigger: '#statsPanel', start: 'top 85%', invalidateOnRefresh: true }
  });

  /* contact — masked headline, then the CTAs walk in */
  gsap.to('#contact .mask-line>span', {
    y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '#contact', start: 'top 70%' }
  });
  gsap.from('.contact-links .btn', {
    y: 34, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
    immediateRender: false,
    scrollTrigger: { trigger: '.contact-links', start: 'top 92%', invalidateOnRefresh: true }
  });

  /* footer + final debrief */
  gsap.from('footer > span', {
    y: 20, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08,
    immediateRender: false,
    scrollTrigger: { trigger: 'footer', start: 'top 97%', invalidateOnRefresh: true }
  });
  gsap.from('.final-feedback-section > *', {
    y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12,
    immediateRender: false,
    scrollTrigger: { trigger: '.final-feedback-section', start: 'top 92%', invalidateOnRefresh: true }
  });

  /* HUD visor — iris-in entrance, then a slow parallax drift while in view
     (transform-only scrub; the SMIL marquee inside keeps its own clock) */
  gsap.from('.hud-visor', {
    opacity: 0, clipPath: 'inset(28% 6% 28% 6%)', duration: 1.4,
    ease: 'power3.inOut', immediateRender: false,
    scrollTrigger: { trigger: '.hud-visor', start: 'top 88%', invalidateOnRefresh: true }
  });
  gsap.fromTo('#visorSvg', { yPercent: -5 }, {
    yPercent: 5, ease: 'none',
    scrollTrigger: { trigger: '.hud-visor', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  /* hero exit — the glass card recedes and dims as the visor takes over
     (yPercent/scale/opacity coexist cleanly with the gyro tilt's rotationX/Y) */
  gsap.to('.hero-glass', {
    yPercent: -8, scale: 0.985, opacity: 0.25, ease: 'none',
    transformOrigin: 'center top',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true }
  });
  gsap.to('.hero-meta', {
    yPercent: -140, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 55%', scrub: true }
  });

  /* ribbon — permanent fixed backdrop; no exit fade. The ribbon stays at full
     opacity for the entire page lifetime. The intro fade-up (main.js boot) is
     the only opacity transition it ever receives. */
}

/* skew on scroll velocity — the page leans into fast scrolls.
   NOTE: we must NOT transform #skewWrap (it wraps every section); a transformed
   ancestor breaks position:fixed used by ScrollTrigger pin on #ops, which made
   later sections clip/vanish and thrashed layout. Skew only the hero heading,
   and reuse a single quickTo setter instead of creating a tween every frame. */
if (!isMobile && !reduceMotion) {
  const skewTarget = document.querySelector('#hero .hero-name') || document.querySelector('#hero');
  if (skewTarget) {
    const setSkew = gsap.quickTo(skewTarget, 'skewY', { duration: 0.5, ease: 'power2.out' });
    let lastY = 0;
    let lastV = 0;
    gsap.ticker.add(() => {
      const y = lenis.scroll;
      const v = gsap.utils.clamp(-6, 6, (y - lastY) * 0.18) * 0.4;
      lastY = y;
      if (Math.abs(v - lastV) < 0.01) return; /* skip redundant frames */
      lastV = v;
      setSkew(v);
    });
  }
}

/* stats count-up */
ScrollTrigger.create({
  trigger: '#statsPanel', start: 'top 80%', once: true,
  onEnter: () => {
    document.querySelectorAll('[data-t]').forEach((n) => {
      gsap.to({ v: 0 }, {
        v: +n.dataset.t, duration: 2.2, ease: 'power3.out',
        onUpdate: function () { n.textContent = Math.round(this.targets()[0].v); }
      });
    });
  }
});

/* ====================================================
   LIVE CLOCK — real Asia/Karachi time (it says PKT, so it must BE PKT;
   the old getHours() showed the visitor's local time under a PKT label)
==================================================== */
const tickClock = () => {
  const el = document.getElementById('clock');
  if (!el) return;
  try {
    el.textContent = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' PKT';
  } catch (_) {
    el.textContent = new Date().toTimeString().slice(0, 5);
  }
};
tickClock();

/* ====================================================
   VISIBILITY-AWARE TICKERS
   The clock (1s) and the HUD latency flicker (3s) were both uncleared
   setIntervals that kept firing for the whole session, including while the tab
   was buried in the background. They now suspend on visibilitychange and pick
   straight back up when the tab is foregrounded.
==================================================== */
const liveTimers = new Set();

function liveInterval(fn, ms) {
  let id = 0;
  const timer = {
    start() { if (!id) id = setInterval(fn, ms); },
    stop() { if (id) { clearInterval(id); id = 0; } },
  };
  liveTimers.add(timer);
  timer.start();
  return timer;
}

document.addEventListener('visibilitychange', () => {
  liveTimers.forEach((t) => (document.hidden ? t.stop() : t.start()));
});

liveInterval(tickClock, 1000);

/* footer year — never goes stale again */
const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = `© ${new Date().getFullYear()} Mehmood Lodhi`;

/* ====================================================
   SENTINEL HUD — the island dispatches `sentinel:online` once the skull has
   materialised and the eyes have lit; the frame's readout flips with it.
==================================================== */
window.addEventListener('sentinel:online', () => {
  const stage = document.getElementById('sentinelStage');
  const status = document.querySelector('[data-sentinel-status]');
  if (stage) stage.classList.add('is-online');
  if (status) status.textContent = 'Online';
});

/* ====================================================
   INTEL REPORT — cursor-lit cells. One delegated listener, rect cached per
   hovered cell (reading it per move forces layout).
==================================================== */
if (!isMobile) {
  const panel = document.getElementById('statsPanel');
  if (panel) {
    let hotStat = null;
    let statRect = null;
    panel.addEventListener('pointermove', (e) => {
      const cell = e.target.closest ? e.target.closest('.stat') : null;
      if (!cell) { hotStat = null; statRect = null; return; }
      if (cell !== hotStat) { hotStat = cell; statRect = cell.getBoundingClientRect(); }
      cell.style.setProperty('--gx', `${(((e.clientX - statRect.left) / statRect.width) * 100).toFixed(1)}%`);
      cell.style.setProperty('--gy', `${(((e.clientY - statRect.top) / statRect.height) * 100).toFixed(1)}%`);
    }, { passive: true });
    panel.addEventListener('pointerleave', () => { hotStat = null; statRect = null; });
    window.addEventListener('scroll', () => { statRect = null; hotStat = null; }, { passive: true });
  }
}

/* ====================================================
   OFF-SCREEN ANIMATION FREEZE — the hero gradient (paint-heavy
   background-position), cert shimmer, stat orbs and floating chips all ran
   their infinite CSS loops for the entire session no matter where you were on
   the page. Pause them via class while their section is off-screen.
==================================================== */
if ('IntersectionObserver' in window) {
  const animIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('anim-off', !e.isIntersecting));
  }, { rootMargin: '80px 0px' });
  ['#hero', '#about', '#certs', '#stats'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) animIO.observe(el);
  });
}

/* ====================================================
   DECRYPT REVEAL — section labels resolve from cipher glyphs as they enter,
   like an intercepted transmission decoding. One-shot per label, rAF-driven,
   skipped entirely under prefers-reduced-motion.
==================================================== */
if (!reduceMotion) {
  const CIPHER = '01<>/\\#$%&@!?';
  document.querySelectorAll('.sec-label span:not(.sec-num)').forEach((el) => {
    const finalText = el.textContent;
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => {
        const t0 = performance.now();
        const DUR = 900;
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / DUR);
          const lock = Math.floor(finalText.length * p);
          let out = '';
          for (let i = 0; i < finalText.length; i++) {
            out += (i < lock || finalText[i] === ' ')
              ? finalText[i]
              : CIPHER[(Math.random() * CIPHER.length) | 0];
          }
          el.textContent = out;
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = finalText;
        };
        requestAnimationFrame(tick);
      },
    });
  });
}

/* ====================================================
   SYSTEM INTEL HUD — subtle live latency flicker (3s, ±2ms)
==================================================== */
const latencyEl = document.getElementById('latencyValue');
if (latencyEl) {
  /* textContent on a dedicated node. The old version rewrote the parent's
     innerHTML every 3 seconds, which re-parsed the markup and rebuilt the
     LATENCY label element each time, forever. */
  liveInterval(() => {
    latencyEl.textContent = `${10 + Math.floor(Math.random() * 5)}ms`;
  }, 3000);
}

/* ====================================================
   FINAL FEEDBACK WIDGET — runaway NO + randomized YES

   The old version was reactive and unbounded: it waited for mouseenter, so the
   cursor had to LAND on NO before it moved (on a quick approach you simply
   clicked it), and it fled by translating within the button flex row — a
   ~300x50px world. That is why it got cornered, why it overlapped YES, and why
   it was regularly clickable.

   This is a proximity engine instead:
     - #feedback-arena is a real, generously sized, INVISIBLE bounding box, and
       every position NO can take is clamped inside it. The arena IS the world.
       NO still moves on transform only, so it never leaves the flex row and YES
       cannot drift when it runs.
     - one passive pointermove watches the distance from cursor to NO and
       relocates it BEFORE contact, so the cursor never arrives.
     - relocation SCORES candidate positions instead of rejection-sampling:
       far from the pointer, clear of YES, and away from the arena edges. That
       last term is what actually kills corner-trapping — a corner scores badly
       by construction, so it is never the winner.
     - under prefers-reduced-motion nothing chases; NO stays in flow and just
       answers, which is the sensible fallback.
==================================================== */
(() => {
  const arena = document.getElementById('feedback-arena');
  const yesBtn = document.getElementById('yes-btn');
  const noBtn = document.getElementById('no-btn');
  const response = document.getElementById('feedback-response');
  if (!arena || !yesBtn || !noBtn || !response) return;

  /* Randomized success trigger on YES */
  const phrases = [
    'fr fr i knew it was bussing, no cap \uD83E\uDDE2\uD83D\uDD25',
    'valid response terminal unlocked, u dropped this \uD83D\uDC51'
  ];
  let yesTimer = 0;
  yesBtn.addEventListener('click', () => {
    response.textContent = '[ACCESS GRANTED]...';
    clearTimeout(yesTimer);
    yesTimer = setTimeout(() => {
      response.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    }, 700);
  });

  /* ---------- reduced motion: no chase, ordinary button ---------- */
  if (reduceMotion) {
    noBtn.addEventListener('click', () => {
      response.textContent = '[REQUEST DENIED] logged anyway. thanks for scrolling.';
    });
    return;
  }

  /* ---------- geometry ----------
     Two caches with different lifetimes, because they go stale for different
     reasons and cost different amounts:

       arenaRect  client-space, so SCROLLING invalidates it. One cheap
                  getBoundingClientRect().
       layout     arena-LOCAL box sizes and NO's natural origin. Scrolling
                  cannot change these; only a RESIZE can. Refreshing it means
                  briefly clearing NO's transform to read its untransformed
                  origin, which forces a reflow — far too expensive to do on a
                  scroll frame, and completely unnecessary there.

     Reading either one inside the pointermove handler directly would force a
     synchronous layout on every frame of cursor travel. */
  let arenaRect = null;
  let layout = null;   // { base:{x,y}, w, h, yes:{x,y,w,h} }
  let pos = null;      // NO's CURRENT top-left, arena-local

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const measureLayout = () => {
    arenaRect = arena.getBoundingClientRect();
    // read NO's natural (untransformed) origin — the anchor every translate is
    // expressed against
    const prevT = noBtn.style.transform;
    const prevTr = noBtn.style.transition;
    noBtn.style.transition = 'none';
    noBtn.style.transform = 'none';
    const b = noBtn.getBoundingClientRect();
    const y = yesBtn.getBoundingClientRect();
    noBtn.style.transform = prevT;
    void noBtn.offsetWidth;                 // flush, so restoring cannot animate
    noBtn.style.transition = prevTr;

    layout = {
      base: { x: b.left - arenaRect.left, y: b.top - arenaRect.top },
      w: b.width, h: b.height,
      yes: { x: y.left - arenaRect.left, y: y.top - arenaRect.top, w: y.width, h: y.height },
    };
    if (!pos) pos = { x: layout.base.x, y: layout.base.y };
  };

  const ensure = () => {
    if (!layout) measureLayout();
    else if (!arenaRect) arenaRect = arena.getBoundingClientRect();
  };

  /* x/y are the desired top-left in arena-local coords; the translate is the
     delta from NO's natural origin, so an identity transform IS its start spot. */
  const place = (x, y) => {
    pos = { x, y };
    noBtn.classList.add('is-fleeing');
    const t = `translate3d(${(x - layout.base.x).toFixed(1)}px, ` +
              `${(y - layout.base.y).toFixed(1)}px, 0)`;
    // mirrored onto a custom property so the :active rule can hold the position
    noBtn.style.setProperty('--no-t', t);
    noBtn.style.transform = t;
  };

  addEventListener('scroll', () => { arenaRect = null; }, { passive: true });
  addEventListener('resize', () => {
    // a resize reflows the arena, so a stored position can now sit outside it —
    // re-clamp rather than leaving NO stranded past the new edge (or, on a
    // phone rotate, off the layout entirely)
    layout = null; arenaRect = null;
    if (!noBtn.classList.contains('is-fleeing')) { pos = null; return; }
    measureLayout();
    place(clamp(pos.x, 0, Math.max(0, arenaRect.width - layout.w)),
          clamp(pos.y, 0, Math.max(0, arenaRect.height - layout.h)));
  }, { passive: true });

  /* Distance from a point to the nearest edge of a rect (0 when inside). */
  const rectDist = (px, py, rx, ry, rw, rh) => {
    const dx = Math.max(rx - px, 0, px - (rx + rw));
    const dy = Math.max(ry - py, 0, py - (ry + rh));
    return Math.hypot(dx, dy);
  };

  /* ---------- escape ----------
     Candidates: a deterministic 6x4 lattice across the arena (guaranteed
     coverage — pure random sampling is how the old one kept re-picking the same
     dead ends) plus a few jittered points so it never feels metronomic. */
  const escape = (pointerX, pointerY) => {
    ensure();
    const { w: btnW, h: btnH, yes } = layout;
    const maxX = Math.max(0, arenaRect.width - btnW);
    const maxY = Math.max(0, arenaRect.height - btnH);
    if (maxX < 4 && maxY < 4) return;          // degenerate arena: nowhere to go

    const YES_PAD = 16;
    const cands = [];
    for (let cx = 0; cx < 6; cx++) {
      for (let cy = 0; cy < 4; cy++) cands.push({ x: (cx / 5) * maxX, y: (cy / 3) * maxY });
    }
    for (let i = 0; i < 8; i++) cands.push({ x: Math.random() * maxX, y: Math.random() * maxY });

    let best = null;
    let bestScore = -Infinity;
    for (const c of cands) {
      // hard reject: never land on (or right beside) YES
      if (c.x + btnW > yes.x - YES_PAD && c.x < yes.x + yes.w + YES_PAD &&
          c.y + btnH > yes.y - YES_PAD && c.y < yes.y + yes.h + YES_PAD) continue;

      // distance from the cursor to the candidate BOX, not its centre: the
      // cursor can sit right against a wide pill and still be far from its middle
      const dPointer = rectDist(pointerX, pointerY, c.x, c.y, btnW, btnH);
      // breathing room on all four sides — the anti-corner-trap term
      const dEdge = Math.min(c.x, maxX - c.x, c.y, maxY - c.y);
      // and don't just twitch in place. Rewarding travel alone was not enough:
      // in a narrow arena (a phone, where YES_PAD rejects most of the width)
      // the winning candidate was measured at ~33px away, which reads as a
      // glitch rather than an escape. Anything that fails to move at least the
      // button's own width now takes a penalty that scales with how badly it
      // fell short, so a genuine relocation nearly always outscores a twitch.
      const travel = Math.hypot(c.x - pos.x, c.y - pos.y);
      const stall = travel < btnW ? (btnW - travel) * 1.6 : 0;

      const score = Math.min(dPointer, 260)
                  + Math.min(dEdge, 70) * 0.9
                  + Math.min(travel, 200) * 0.25
                  - stall;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    // every lattice point overlapped YES (an arena squeezed to almost nothing):
    // rather than freeze, take the far corner from the pointer
    if (!best) best = { x: pointerX > maxX / 2 ? 0 : maxX, y: pointerY > maxY / 2 ? 0 : maxY };
    place(best.x, best.y);
  };

  /* Dormant briefly after render so the first thing anyone sees is a clean,
     perfectly centred YES / NO pair, not a button already mid-flight. */
  let armed = false;
  setTimeout(() => { armed = true; }, 600);

  /* ---------- the chase ----------
     Window-level pointermove (passive, coalesced into a single rAF) so NO reacts
     to an approach from anywhere on the page, not only once contact is made. */
  let queued = false;
  let px = 0, py = 0;

  const evaluate = () => {
    queued = false;
    if (!armed) return;
    ensure();

    // ignore the pointer entirely while it is nowhere near the arena
    if (rectDist(px, py, arenaRect.left, arenaRect.top,
                 arenaRect.width, arenaRect.height) > 160) return;

    const lx = px - arenaRect.left;
    const ly = py - arenaRect.top;
    // the trigger ring sits well outside the pill, so the cursor is turned away
    // long before it can land on it
    if (rectDist(lx, ly, pos.x, pos.y, layout.w, layout.h) < 78) escape(lx, ly);
  };

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;     // touch is handled on tap instead
    px = e.clientX; py = e.clientY;
    if (queued) return;
    queued = true;
    requestAnimationFrame(evaluate);
  }, { passive: true });

  /* Touch and pen have no hover, so there is no approach to detect — the tap IS
     the approach. Swallow it and jump, same bounds, same scoring. */
  noBtn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !armed) return;
    e.preventDefault();
    ensure();
    escape(e.clientX - arenaRect.left, e.clientY - arenaRect.top);
  });

  /* Backstop: if a click ever does land (keyboard activation, a synthetic
     click, a pointer that teleported), it dodges rather than doing nothing. */
  noBtn.addEventListener('click', (e) => {
    if (!armed) return;
    e.preventDefault();
    ensure();
    escape(px - arenaRect.left, py - arenaRect.top);
  });
})();

/* ====================================================
   EASTER EGG 1 — TERMINAL SELF-DESTRUCT
==================================================== */
(() => {
  const btn = document.getElementById('destruct-btn');
  if (!btn) return;
  let armed = false;

  btn.addEventListener('click', async () => {
    if (armed) return;
    armed = true;
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    const startedAt = performance.now();

    try {
      const { startSelfDestruct } = await import('./selfDestruct.js');
      await startSelfDestruct(btn, startedAt, reduceMotion);
    } catch (error) {
      console.error('Self-destruct sequence failed:', error);
      window.location.reload();
    }
  });
})();

/* ====================================================
   EASTER EGG 2 — HIDDEN SECRET MATRIX CODE ("cyber")
==================================================== */
(() => {
  const SECRET = 'cyber';
  let buffer = '';
  let active = false;

  function trigger() {
    if (active) return;
    active = true;

    /* full-screen system-compromised flash */
    const alertEl = document.createElement('div');
    alertEl.className = 'system-compromised';
    alertEl.textContent = '[SYSTEM COMPROMISED]';
    document.body.appendChild(alertEl);

    /* swap neon glow cyan → crimson */
    document.documentElement.classList.add('compromised');

    /* soft red matrix particle overlay */
    const matrix = document.createElement('div');
    matrix.className = 'matrix-overlay';
    for (let i = 0; i < 40; i++) {
      const drop = document.createElement('span');
      drop.className = 'matrix-drop';
      drop.textContent = Math.random() > 0.5 ? '1' : '0';
      drop.style.left = Math.random() * 100 + 'vw';
      drop.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
      drop.style.animationDelay = (Math.random() * 0.8) + 's';
      drop.style.fontSize = (10 + Math.random() * 14) + 'px';
      matrix.appendChild(drop);
    }
    document.body.appendChild(matrix);

    setTimeout(() => {
      alertEl.remove();
      matrix.remove();
      document.documentElement.classList.remove('compromised');
      active = false;
    }, 3000);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-SECRET.length);
    if (buffer === SECRET) {
      buffer = '';
      trigger();
    }
  });
})();
