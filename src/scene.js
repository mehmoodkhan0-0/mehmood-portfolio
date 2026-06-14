/**
 * scene.js — DISABLED.
 * The WebGL hero background has been fully abandoned in favour of a pure-CSS
 * "Stealth Eclipse" aesthetic. initScene is kept as a no-op so main.js's lazy
 * import contract still resolves, but no canvas/render loop runs and nothing
 * is drawn to #webgl (which is also hidden via CSS).
 */
export function initScene() {
  // Intentionally empty: no Three.js scene, no render loop, no canvas output.
  return { scrollMorph: { shard: 0, spin: 0 } };
}
