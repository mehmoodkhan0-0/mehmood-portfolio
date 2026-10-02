/**
 * animatedFooterIsland.jsx — React island bootstrap for the ANIMATED FOOTER.
 *
 * The live page is vanilla JS (index.html → main.js); React is NOT booted
 * globally. This module mounts <AnimatedFooter/> into #animatedFooterRoot, the
 * closing statement at the very bottom of the layout. Same discipline as the
 * hero-ribbon and Sentinel islands: main.js only imports this chunk once the
 * footer is near the viewport, and the island unmounts when it is scrolled
 * well away — the component cancels its rAF loop on unmount, so the ASCII
 * canvases cost nothing while you are up at the top of the page.
 *
 * REVEAL — the footer is driven in CONTROLLED mode via `revealed` rather than
 * left to its own scroll observer. Its internal observer resolves a root by
 * walking for a scrollable ancestor, and this page sets `overflow-x:hidden` on
 * <html>/<body>, which makes their computed `overflow-y` resolve to `auto`.
 * Handing that back as a root yields a root box the height of the whole
 * document, so the footer would read as permanently intersecting and the
 * reveal would fire on load. Observing against the viewport (root:null) here is
 * unambiguous, and it keeps the trigger point in one obvious place.
 *
 * The ASCII source art is a pair of genuine reaching-hand photographs
 * (public/animated-footer/) — dark subject on white, because the component maps
 * DARK pixels to dense glyphs and skips the bright ones.
 */
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AnimatedFooter from '@/components/ui/animated-footer';

/** Plays the footer in when it is genuinely on screen, out when it leaves. */
function RevealedFooter() {
  const hostRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setRevealed(true); // no IO support — never leave the copy masked
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setRevealed(entry.isIntersecting);
      },
      // root:null → the viewport, explicitly. 0.3 of a ~78vh footer means the
      // reveal fires once roughly a quarter of the screen is filled by it.
      { root: null, threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="site-animated-footer-stage">
      <AnimatedFooter
        headingText={['MEHMOOD', 'LODHI']}
        className="site-animated-footer"
        leftImage="/animated-footer/hand-left.png"
        rightImage="/animated-footer/hand-right.png"
        background="#050507"
        textColor="#f4f1e8"
        /* gilded ASCII: dim bronze at rest, igniting to champagne under the
           cursor — the site's jewellery palette, never the neon default. */
        charColor="#6f5629"
        hoverColor="#d8ba7c"
        hoverCharColor="#050507"
        columns={72}
        cellSize={16}
        fontSize={14}
        parallaxStrength={16}
        hoverRadius={7}
        revealed={revealed}
      />
    </div>
  );
}

export function initAnimatedFooter() {
  const host = document.getElementById('animatedFooterRoot');
  if (!host) return;

  const root = createRoot(host);
  let mounted = false;

  const mount = () => {
    if (mounted) return;
    mounted = true;
    root.render(
      <StrictMode>
        <RevealedFooter />
      </StrictMode>,
    );
  };

  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    root.render(null); // effect cleanup cancels the rAF loop + mousemove handler
  };

  mount();

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => (entries.some((e) => e.isIntersecting) ? mount() : unmount()),
      { rootMargin: '600px 0px' },
    );
    io.observe(host);
  }
}
