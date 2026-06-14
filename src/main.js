/**
 * main.js — Application entry.
 * Orchestrates: smooth scroll, preloader, cursor, WebGL (lazy, desktop only),
 * dynamic section rendering from the data layer, and all scroll choreography.
 */
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { skills, certs, timeline, missions, marqueeWords } from './data.js';
import { initCursor, refreshCursorTargets } from './cursor.js';
import { runPreloader } from './preloader.js';
import { initParticles } from './particles.js';

gsap.registerPlugin(ScrollTrigger);

const isMobile = window.innerWidth < 769 || /Mobi|Android/i.test(navigator.userAgent);
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
   WEBGL — lazily imported so mobile never downloads Three.js
==================================================== */
if (!isMobile) {
  import('./scene.js').then(({ initScene }) => {
    initScene(mouse, () => lenis.scroll);
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
  gsap.to('#hero .ch', { y: 0, duration: 1.2, stagger: 0.045, ease: 'expo.out' });
  gsap.to('#hero .mask-line>span:not(.split-chars)', {
    y: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out', delay: 0.15
  });
  gsap.to('#webgl', { opacity: isMobile ? 0 : 1, duration: 2, ease: 'power2.out' });
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

/* ambient particle field + click burst (isolated 2D canvas) */
initParticles();

/* ====================================================
   CURSOR + MAGNETIC BUTTONS (desktop only)
==================================================== */
if (!isMobile) {
  initCursor(mouse);

  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(btn, { x: dx * 0.3, y: dy * 0.3, duration: 0.4 });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,.4)' });
    });
  });
}

/* ====================================================
   AGENCY-TIER MICRO-INTERACTIONS
   NOTE: invoked AFTER dynamic sections render (see initMicroInteractions()
   call further down), because .cert-face and .op-card are injected from the
   data layer and do not exist at this point in the file. A WeakSet keeps the
   binding idempotent in case it is ever called again.
==================================================== */
const microBound = new WeakSet();

function initMicroInteractions() {
  // 3D gyro-tilt (desktop only) — gentle, max 2deg, mouse-anchored.
  // Excludes .op-card on purpose: those are transformed by the #ops pin and a
  // competing transform would jitter the pin. One reused quickTo setter per card.
  if (!isMobile) {
    document.querySelectorAll('.hero-glass, .cert-face, .feedback-card').forEach((card) => {
      if (microBound.has(card)) return;
      microBound.add(card);
      const setRX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
      const setRY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });
      card.style.transformPerspective = '900px';
      card.style.transformStyle = 'preserve-3d';
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;  // -0.5 .. 0.5
        const py = (e.clientY - r.top) / r.height - 0.5;
        setRY(px * 4);        // max ~2deg each side
        setRX(-py * 4);
      });
      card.addEventListener('mouseleave', () => { setRX(0); setRY(0); });
    });
  }

  // Voltage feedback — 0.1s brightness/glow spike on click via CSS class toggle.
  // (.cert-face intentionally excluded: those cards live inside the preserve-3d
  // carousel ring, and an extra filter/transform there can cause flip ghosting.)
  document.querySelectorAll('.btn, .op-card').forEach((el) => {
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
  gsap.fromTo('.menu-overlay .m-link',
    { y: 80, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.07, duration: 0.8, ease: 'expo.out', delay: 0.15 });
  lenis.stop();
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  overlay.classList.remove('open');
  burger.classList.remove('open');
  lenis.start();
}

if (burger) {
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
}

/* ====================================================
   DYNAMIC SECTIONS — rendered from the data layer
==================================================== */

/* marquee — duplicated track for a seamless loop */
const mqEl = document.getElementById('mq');
if (mqEl) {
  mqEl.innerHTML = marqueeWords.concat(marqueeWords)
    .map((w, i) => `<span class="${i % 4 === 1 ? 'solid' : ''}">${w} \u2726</span>`)
    .join('');
}

/* journey timeline */
const tlItemsEl = document.getElementById('tlItems');
if (tlItemsEl) {
  tlItemsEl.innerHTML = timeline.map((t) => `
  <div class="tl-item">
    <span class="tl-dot"></span>
    <div class="tl-marker">${t.marker}</div>
    <div class="tl-body"><h3>${t.title}</h3><p>${t.text}</p></div>
  </div>`).join('');
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

/* field operations cards */
const opsTrackEl = document.getElementById('opsTrack');
if (opsTrackEl) {
  opsTrackEl.innerHTML = missions.map((m, i) => `
  <article class="op-card" data-cursor="←→">
    <span class="op-idx">OP—0${i + 1}</span>
    <span class="op-tag">${m.tag}</span>
    <h3>${m.title}</h3>
    <p>${m.text}</p>
  </article>`).join('');
}

/* certification carousel */
const carousel = document.getElementById('carousel');
const step = 360 / certs.length;
const radius = 320;
if (carousel) {
  carousel.innerHTML = certs.map((c, i) => `
  <div class="cert" style="transform:rotateY(${i * step}deg) translateZ(${radius}px)">
    <div class="cert-inner">
      <div class="cert-face">
        <span class="cert-tag">Verified Credential</span>
        <div><h3>${c.org}</h3><p style="color:var(--gold)">${c.title}</p></div>
        <span class="cert-tag" style="color:var(--text2)">Hover to flip</span>
      </div>
      <div class="cert-face back">
        <span class="cert-tag">Details</span>
        <p>${c.detail}</p>
        <span class="cert-tag" style="color:var(--gold)">\u2b21 Authenticated</span>
      </div>
    </div>
  </div>`).join('');
}

/* dynamic DOM is in place — (re)bind cursor targets, anchors, micro-interactions */
if (!isMobile) refreshCursorTargets();
bindAnchors();
initMicroInteractions();

/* ====================================================
   CAROUSEL — drag / wheel / auto-spin
==================================================== */
let rotY = 0, dragging = false, sx = 0, autoSpin = true;
const stage = document.querySelector('.carousel-stage');
if (stage && carousel) {
  stage.addEventListener('pointerdown', (e) => { dragging = true; autoSpin = false; sx = e.clientX; });
  window.addEventListener('pointermove', (e) => {
    if (dragging) {
      rotY += (e.clientX - sx) * 0.4;
      sx = e.clientX;
      carousel.style.transform = `rotateY(${rotY}deg)`;
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; setTimeout(() => (autoSpin = true), 2500); });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    rotY += e.deltaY * 0.2;
    carousel.style.transform = `rotateY(${rotY}deg)`;
  }, { passive: false });
  setInterval(() => {
    if (autoSpin && !dragging) {
      rotY += 0.12;
      carousel.style.transform = `rotateY(${rotY}deg)`;
    }
  }, 30);
}

/* ====================================================
   SCROLL CHOREOGRAPHY
==================================================== */

/* nav shrink + progress bar */
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('shrunk', scrollY > 80);
  document.getElementById('pbar').style.width =
    (scrollY / (document.body.scrollHeight - innerHeight) * 100) + '%';
}, { passive: true });

/* depth fly-ins */
document.querySelectorAll(
  'section:not(#hero) .sec-label, .about-lede, .about-frame, .stats-grid, ' +
  '.carousel-stage, .skill-row, .contact-links, .sec-head, .tl-item'
).forEach((el) => {
  gsap.from(el, {
    y: 90, rotationX: -35, opacity: 0,
    transformPerspective: 800, transformOrigin: 'center bottom',
    duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' }
  });
});

document.querySelectorAll('.rev').forEach((el, i) => {
  gsap.from(el, {
    y: 40, opacity: 0, duration: 0.9, delay: i * 0.1,
    scrollTrigger: { trigger: el, start: 'top 90%' }
  });
});

/* timeline spine draws as you scroll */
gsap.fromTo('.tl-line', { scaleY: 0 }, {
  scaleY: 1, ease: 'none',
  scrollTrigger: { trigger: '.timeline', start: 'top 80%', end: 'bottom 55%', scrub: true }
});

/* contact headline reveal */
gsap.to('#contact .mask-line>span', {
  y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out',
  scrollTrigger: { trigger: '#contact', start: 'top 70%' }
});

/* pinned horizontal scroll — field operations (desktop only) */
if (!isMobile) {
  const track = document.getElementById('opsTrack');
  gsap.to(track, {
    x: () => -(track.scrollWidth - innerWidth + innerWidth * 0.12),
    ease: 'none',
    scrollTrigger: {
      trigger: '#ops',
      start: 'top top',
      end: () => '+=' + (track.scrollWidth - innerWidth),
      scrub: 1,
      pin: true,
      invalidateOnRefresh: true
    }
  });
}

/* skew on scroll velocity — the page leans into fast scrolls.
   NOTE: we must NOT transform #skewWrap (it wraps every section); a transformed
   ancestor breaks position:fixed used by ScrollTrigger pin on #ops, which made
   later sections clip/vanish and thrashed layout. Skew only the hero heading,
   and reuse a single quickTo setter instead of creating a tween every frame. */
if (!isMobile) {
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
   LIVE CLOCK
==================================================== */
setInterval(() => {
  const d = new Date();
  const el = document.getElementById('clock');
  if (el) {
    el.textContent =
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ' PKT';
  }
}, 1000);

/* ====================================================
   SYSTEM INTEL HUD — subtle live latency flicker (3s, ±2ms)
==================================================== */
setInterval(() => {
  const el = document.getElementById('dynamic-latency');
  if (el) el.innerHTML = `<span>LATENCY</span>: ${10 + Math.floor(Math.random() * 5)}ms`;
}, 3000);

/* ====================================================
   FINAL FEEDBACK WIDGET — runaway NO + randomized YES
==================================================== */
(() => {
  const zone = document.querySelector('.feedback-buttons');
  const yesBtn = document.getElementById('yes-btn');
  const noBtn = document.getElementById('no-btn');
  const response = document.getElementById('feedback-response');
  if (!zone || !yesBtn || !noBtn || !response) return;

  /* Run-away stays dormant until shortly after render so the user first sees a
     perfectly aligned, in-flow layout. Only then does NO become absolute and flee. */
  let runawayArmed = false;
  setTimeout(() => { runawayArmed = true; }, 600);

  /* Runaway NO button — flees via transform:translate so the CSS cubic-bezier
     transition smooths the motion. NO stays in normal flex flow (never absolute),
     so it starts perfectly centered next to YES and YES never shifts when it moves.
     The translate offset is measured from NO's natural, untransformed position. */
  noBtn.addEventListener('mouseenter', () => {
    if (!runawayArmed) return;

    const zoneRect = zone.getBoundingClientRect();
    const btnRect = noBtn.getBoundingClientRect();
    const yesRect = yesBtn.getBoundingClientRect();

    // NO's current visual top-left already includes any active transform; subtract
    // it to recover the natural (untransformed) origin inside the zone.
    const cur = currentTranslate(noBtn);
    const baseLeft = btnRect.left - zoneRect.left - cur.x;
    const baseTop = btnRect.top - zoneRect.top - cur.y;

    const maxX = Math.max(0, zoneRect.width - btnRect.width);
    const maxY = Math.max(0, zoneRect.height - btnRect.height);

    /* YES box relative to the zone, padded so NO keeps clear */
    const pad = 12;
    const yLeft = yesRect.left - zoneRect.left - pad;
    const yTop = yesRect.top - zoneRect.top - pad;
    const yRight = yLeft + yesRect.width + pad * 2;
    const yBottom = yTop + yesRect.height + pad * 2;

    let targetLeft, targetTop;
    let tries = 0;
    do {
      targetLeft = Math.random() * maxX;
      targetTop = Math.random() * maxY;
      tries += 1;
    } while (
      tries < 40 &&
      targetLeft + btnRect.width > yLeft && targetLeft < yRight &&
      targetTop + btnRect.height > yTop && targetTop < yBottom
    );

    // Translate = desired position minus natural position. CSS transition does the rest.
    noBtn.style.transform =
      'translate(' + (targetLeft - baseLeft) + 'px,' + (targetTop - baseTop) + 'px)';
  });

  /* Read the current translate() offset from the computed matrix (0,0 if none). */
  function currentTranslate(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return { x: 0, y: 0 };
    const m = t.match(/matrix\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(parseFloat);
      return { x: parts[4] || 0, y: parts[5] || 0 };
    }
    return { x: 0, y: 0 };
  }

  /* Randomized success trigger on YES */
  const phrases = [
    'fr fr i knew it was bussing, no cap \uD83E\uDDE2\uD83D\uDD25',
    'valid response terminal unlocked, u dropped this \uD83D\uDC51'
  ];
  yesBtn.addEventListener('click', () => {
    response.textContent = '[ACCESS GRANTED]...';
    setTimeout(() => {
      response.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    }, 700);
  });
})();

/* ====================================================
   EASTER EGG 1 — TERMINAL SELF-DESTRUCT
==================================================== */
(() => {
  const btn = document.getElementById('destruct-btn');
  if (!btn) return;
  let armed = false;

  btn.addEventListener('click', () => {
    if (armed) return;
    armed = true;
    let count = 3;
    btn.textContent = '[ ' + count + ' ]';
    const tick = setInterval(() => {
      count -= 1;
      if (count > 0) {
        btn.textContent = '[ ' + count + ' ]';
        return;
      }
      clearInterval(tick);
      btn.textContent = '[ 0 ]';
      shatterAndReload();
    }, 1000);
  });

  /* Fragment explosion: tile the viewport, scatter outwards, fall under gravity */
  function shatterAndReload() {
    const W = innerWidth;
    const H = innerHeight;
    const cols = 12;
    const rows = Math.max(6, Math.round((H / W) * cols));
    const fw = W / cols;
    const fh = H / rows;

    const overlay = document.createElement('div');
    overlay.className = 'shatter-overlay';

    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const piece = document.createElement('div');
        piece.className = 'shatter-piece';
        piece.style.width = fw + 'px';
        piece.style.height = fh + 'px';
        piece.style.left = c * fw + 'px';
        piece.style.top = r * fh + 'px';
        /* sample the page background so fragments read as the shattered document */
        piece.style.backgroundPosition = -(c * fw) + 'px ' + -(r * fh) + 'px';
        overlay.appendChild(piece);
        pieces.push({
          el: piece,
          x: 0,
          y: 0,
          vx: (c / cols - 0.5) * 18 + (Math.random() - 0.5) * 6,
          vy: -(6 + Math.random() * 8),
          rot: 0,
          vr: (Math.random() - 0.5) * 22
        });
      }
    }

    document.body.appendChild(overlay);
    document.body.classList.add('blackout-bg');

    const gravity = 0.9;
    let alive = pieces.length;
    let last = performance.now();

    function frame(now) {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      alive = 0;
      pieces.forEach((p) => {
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.el.style.transform =
          'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + p.rot + 'deg)';
        if (p.y < H + fh * 2) alive += 1;
      });
      if (alive > 0) {
        requestAnimationFrame(frame);
      } else {
        location.reload();
      }
    }
    requestAnimationFrame(frame);
    /* safety reset in case a frame stalls */
    setTimeout(() => location.reload(), 4000);
  }
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
