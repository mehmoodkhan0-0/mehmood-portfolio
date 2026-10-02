/**
 * preloader.js — the boot sequence.
 *
 * The macOS welcome, faithfully: black glass, a white handwritten “hello” that
 * writes itself in one unhurried stroke and breathes very slightly as it
 * settles, a thin white boot bar, then a soft dissolve. The site is revealed
 * behind a white seam as the two halves of the lid part; the hero masthead is
 * already rising as the lid clears.
 *
 * Timeline (seconds)
 *   0.00  hello writes in (clip wipe + stroke draw), fill blooms at 1.25
 *   1.00  boot bar fades up, fills 1.05 → 3.05
 *   3.15  hello + bar dissolve (fade + blur)
 *   3.45  seam ignites · 3.65 lid parts · 3.9 hero reveal handoff
 *   4.65  overlay removed
 *
 * Skipped outright under prefers-reduced-motion. Click / any key fast-forwards
 * smoothly (timeScale), never a jump cut.
 */
import gsap from 'gsap';

function teardown() {
  const el = document.getElementById('preloader');
  if (el) el.remove();
  document.documentElement.classList.remove('is-booting');
}

/* the script face must be on screen before the word starts writing, otherwise
   the first frames draw in a fallback cursive and swap mid-stroke */
function fontReady(timeout = 900) {
  if (!document.fonts || typeof document.fonts.load !== 'function') return Promise.resolve();
  return Promise.race([
    document.fonts.load('500 160px "Caveat"').catch(() => {}),
    new Promise((r) => setTimeout(r, timeout)),
  ]);
}

/**
 * @param {Function} onReveal  Hero reveal handoff. Called exactly once on every
 *                             path (skip, error, failsafe, completion).
 * @returns {gsap.core.Timeline|null}
 */
export function runPreloader(onReveal) {
  const root = document.getElementById('preloader');
  const hello = root && root.querySelector('.pre-hello');
  const helloText = root && root.querySelector('.pre-hello-text');
  const barFill = root && root.querySelector('.pre-bar i');
  const pct = root && root.querySelector('.pre-pct');

  const reduce = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let revealed = false;
  const reveal = () => { if (revealed) return; revealed = true; onReveal(); };

  if (!root || !hello || !helloText || !barFill || reduce) {
    teardown();
    reveal();
    return null;
  }

  document.documentElement.classList.add('is-booting');

  try {
    /* the overlay must never be able to strand the visitor on a black screen */
    const failsafe = setTimeout(() => { teardown(); reveal(); }, 8000);

    const counter = { v: 0 };
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => { clearTimeout(failsafe); teardown(); reveal(); },
    });

    tl.set(hello, { autoAlpha: 1 }, 0)
      // the word writes itself: a left→right wipe over a live stroke draw, and
      // the whole word eases up from 96% as the pen travels — Apple's breathe
      .fromTo(hello, { scale: 0.96 }, { scale: 1, duration: 2.2, ease: 'power1.out' }, 0)
      .fromTo(hello,
        { clipPath: 'inset(-14% 102% -14% -2%)' },
        { clipPath: 'inset(-14% -2% -14% -2%)', duration: 1.7, ease: 'power1.inOut' }, 0)
      .to(helloText, { strokeDashoffset: 0, duration: 1.9, ease: 'power1.inOut' }, 0)
      .to(helloText, { fillOpacity: 1, duration: 0.9, ease: 'power2.out' }, 1.25)
      .to(helloText, { strokeOpacity: 0.35, duration: 0.9 }, 1.35)
      // identity line under the word
      .fromTo('.pre-sub', { y: 10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out' }, 1.35)
      // boot bar
      .fromTo('.pre-boot', { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 1.0)
      .to(counter, {
        v: 100, duration: 2.0, ease: 'power2.inOut',
        onUpdate: () => {
          barFill.style.transform = `scaleX(${(counter.v / 100).toFixed(4)})`;
          if (pct) pct.textContent = String(Math.round(counter.v)).padStart(3, '0');
        },
      }, 1.05)
      // dissolve — a soft fade with a whisper of blur, the way macOS crossfades
      .to('.pre-stage, .pre-boot, .pre-skip', {
        autoAlpha: 0, filter: 'blur(6px)', scale: 1.02, duration: 0.55, ease: 'power2.inOut',
      }, 3.15)
      // the seam ignites, then the lid parts
      .fromTo('.pre-seam', { scaleX: 0, autoAlpha: 1 },
        { scaleX: 1, duration: 0.5, ease: 'expo.out' }, 3.45)
      .to('.pre-lid--top', { yPercent: -100, duration: 1.05, ease: 'power4.inOut' }, 3.65)
      .to('.pre-lid--bot', { yPercent: 100, duration: 1.05, ease: 'power4.inOut' }, 3.65)
      .to('.pre-seam', { autoAlpha: 0, scaleY: 10, duration: 0.6, ease: 'power2.out' }, 3.72)
      .add(reveal, 3.9)
      .to(root, { autoAlpha: 0, duration: 0.2 }, 4.65);

    /* fast-forward on intent — smooth, not a jump cut */
    let skipped = false;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      tl.timeScale(3.2);
    };
    root.addEventListener('pointerdown', skip, { passive: true });
    window.addEventListener('keydown', skip, { once: true });

    fontReady().then(() => tl.play());
    return tl;
  } catch (err) {
    console.warn('[preloader] intro failed, revealing immediately:', err);
    teardown();
    reveal();
    return null;
  }
}
