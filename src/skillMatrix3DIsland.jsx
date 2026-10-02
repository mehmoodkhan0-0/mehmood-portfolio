/**
 * skillMatrix3DIsland.jsx — React island bootstrap for the Sentinel.
 *
 * The live page is vanilla JS (index.html → main.js); React is NOT booted
 * globally. This module mounts <SkillMatrix3D/> into a single container inside
 * the #matrix section. The root mounts ONCE (main.js already defers importing
 * this module until the section approaches), and instead of unmounting on exit
 * — which destroyed and recreated the whole WebGL context + recompiled the
 * skull shader mid-scroll, and could even race two React roots onto one host —
 * it simply freezes the R3F frameloop while off-screen. GPU cost while frozen:
 * zero. Re-entering resumes the loop instantly with no boot hitch.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SkillMatrix3D from './components/sections/SkillMatrix3D.jsx';

export function initSkillMatrix3D() {
  const host = document.getElementById('sentinelRoot');
  if (!host) return;

  let root = null;

  const render = (active) => {
    if (!root) root = createRoot(host);
    root.render(
      <StrictMode>
        <SkillMatrix3D active={active} />
      </StrictMode>,
    );
  };

  if (!('IntersectionObserver' in window)) {
    render(true);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (!root && !visible) return;   // stay unmounted until first seen
      render(visible);
    },
    { rootMargin: '160px 0px', threshold: 0.01 },
  );
  io.observe(host);
}
