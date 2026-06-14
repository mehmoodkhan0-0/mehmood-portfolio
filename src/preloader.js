/**
 * preloader.js — Cinematic intro sequence.
 * Percentage counter 00 → 100, name fade with letter-spacing expansion,
 * then an expo-eased curtain wipe that hands off to the hero reveal
 * while still in motion (the overlap is what makes it feel filmic).
 */
import gsap from 'gsap';

export function runPreloader(onReveal) {
  const counter = { v: 0 };
  const countEl = document.querySelector('.pre-count');
  const barEl = document.querySelector('.pre-bar i');

  const tl = gsap.timeline();

  tl.to('.pre-name', {
    opacity: 1,
    duration: 1,
    ease: 'power2.out',
    letterSpacing: '.45em'
  }, 0);

  tl.to(counter, {
    v: 100,
    duration: 2,
    ease: 'power2.inOut',
    onUpdate: () => {
      countEl.textContent = String(Math.round(counter.v)).padStart(2, '0');
      barEl.style.width = counter.v + '%';
    }
  }, 0);

  tl.to('.pre-count, .pre-bar, .pre-name', {
    opacity: 0,
    y: -30,
    duration: 0.6,
    ease: 'power2.in'
  });

  tl.to('#preloader .curtain', {
    scaleY: 0,
    duration: 1,
    ease: 'expo.inOut'
  });

  tl.to('#preloader', {
    opacity: 0,
    duration: 0.3,
    onComplete: () => {
      const el = document.getElementById('preloader');
      if (el) el.remove();
    }
  });

  // Hero starts revealing 1s before the curtain finishes — cinematic overlap.
  tl.add(onReveal, '-=1');

  return tl;
}
