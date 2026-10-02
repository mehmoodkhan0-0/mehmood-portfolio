/**
 * heroRibbonIsland.jsx — React island bootstrap for the TWISTING RIBBON.
 *
 * The live page is vanilla JS (index.html → main.js); React is NOT booted
 * globally. This module mounts <TwistingRibbon/> into the FIXED backdrop host
 * (#heroRibbonRoot, a direct child of <body>) so the ribbon stays locked to the
 * viewport behind the hero instead of scrolling away with the section.
 *
 * Because the host is fixed it is technically always "on screen", so the old
 * IntersectionObserver on the host itself would never unmount. The observer
 * watches #hero instead: once the hero is scrolled well past, the ribbon is
 * invisible anyway (GSAP has faded it out) and the rAF loop is cancelled —
 * zero CPU off-screen — then remounts seamlessly as the hero returns.
 *
 * PALETTE — warm ember spectrum. The face is a molten orange-red and the folds
 * run amber → gold → jade, so the twist reveals a continuous warm spectrum
 * (the reference look) instead of the carmine/indigo pairing, whose complements
 * averaged out to a flat pink haze across the whole hero.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TwistingRibbon from '@/components/ui/twisting-ribbon';

export function initHeroRibbon() {
  const host = document.getElementById('heroRibbonRoot');
  if (!host) return;

  const root = createRoot(host);
  let mounted = false;

  const mount = () => {
    if (mounted) return;
    mounted = true;
    root.render(
      <StrictMode>
        <TwistingRibbon
          segments={400}
          waveSpeed={0.018}
          waveAmplitude={1}
          twistCycles={6}
          className="hero-ribbon"
          darkColors={{
            face: '#ff3f12',   // molten ember — the ribbon's broad face
            foldA: '#ffc23a',  // amber        the warm turn
            foldB: '#2fd0a8',  // jade         the cool turn
            foldC: '#3f6ae8',  // azure        the deep turn
          }}
        />
      </StrictMode>,
    );
  };

  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    root.render(null); // effect cleanup cancels the rAF loop
  };

  mount(); // the hero is the opening frame — boot immediately

  // Ribbon is a permanent fixed backdrop — never unmount it.
}
