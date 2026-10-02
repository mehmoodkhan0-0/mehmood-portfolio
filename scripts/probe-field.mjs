/**
 * probe-field.mjs — sample the damage() field the skull shader actually uses.
 *
 * The crack network is an iso-contour at dmg == 0.5, so whether cracks appear
 * at all depends on the field's real distribution over the model's object
 * space — not on what the iso-level looks like in the abstract. If the field's
 * median sits well off 0.5, the contour runs through a sparse part of the
 * distribution and the "fracture network" is mostly empty space.
 *
 * This reimplements hash/noise/damage exactly as written in SKULL_FRAG and
 * samples them over the model's measured bounds, reporting the percentiles and
 * how much of the surface falls inside the crack band at a given width.
 */

// --- verbatim ports of the GLSL, so the numbers describe the real shader ---
const fract = (x) => x - Math.floor(x);
function hash(x, y, z) {
  return fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
}
function noise(px, py, pz) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  let fx = px - ix, fy = py - iy, fz = pz - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx),
      L(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    L(L(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx),
      L(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}
const damage = (x, y, z) =>
  noise(x * 6.0, y * 6.0, z * 6.0) * 0.62 +
  noise(x * 14.0, y * 14.0, z * 14.0) * 0.38;

// model bounds measured from skull.glb in the browser
const MIN = [-1.37, -1.38, -1.06];
const MAX = [1.37, 1.94, 2.12];

const vals = [];
const N = 60;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    for (let k = 0; k < N; k++) {
      const x = MIN[0] + (MAX[0] - MIN[0]) * (i / (N - 1));
      const y = MIN[1] + (MAX[1] - MIN[1]) * (j / (N - 1));
      const z = MIN[2] + (MAX[2] - MIN[2]) * (k / (N - 1));
      vals.push(damage(x, y, z));
    }
  }
}
vals.sort((a, b) => a - b);
const pct = (p) => vals[Math.floor(vals.length * p)].toFixed(4);
const mean = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4);

console.log(`samples      ${vals.length}`);
console.log(`min / max    ${vals[0].toFixed(4)} / ${vals[vals.length - 1].toFixed(4)}`);
console.log(`mean         ${mean}`);
console.log(`p01 p10 p25  ${pct(0.01)}  ${pct(0.10)}  ${pct(0.25)}`);
console.log(`p50          ${pct(0.50)}   <-- the crack iso-level should sit here`);
console.log(`p75 p90 p99  ${pct(0.75)}  ${pct(0.90)}  ${pct(0.99)}`);

for (const iso of [0.5, Number(pct(0.5))]) {
  for (const w of [0.010, 0.020, 0.035]) {
    const inBand = vals.filter((v) => Math.abs(v - iso) < w).length / vals.length;
    console.log(`iso=${iso.toFixed(3)} halfwidth=${w.toFixed(3)} -> ${(inBand * 100).toFixed(2)}% of volume inside the band`);
  }
}
