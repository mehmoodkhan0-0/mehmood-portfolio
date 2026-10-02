/**
 * metrics.mjs — quantitative read on a Sentinel capture.
 *
 * Screenshot diffing by eye is unreliable for this material: the whole point of
 * the shader is that emissive terms (fissures, eye spill, fresnel wash) bypass
 * albedo, so "looks red" and "is drowning the form" are indistinguishable
 * without numbers. This decodes the PNG in Chrome and reports:
 *
 *   redDominance  mean R / mean G over lit pixels — how monochrome-red it is
 *   litFrac       fraction of the frame above black, i.e. how much skull there is
 *   detail        mean |laplacian| over lit pixels — proxy for visible surface
 *                 structure (cracks, cheekbones, pitting). A flat blob scores low.
 *   p50/p95/p99   luminance percentiles over lit pixels
 *
 * Usage: node scripts/metrics.mjs <file.png> [...more.png]
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/metrics.mjs <file.png>...'); process.exit(1); }

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const m = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

    // "lit" = anything meaningfully above the black stage background
    const LIT = 18;
    let rs = 0, gs = 0, bs = 0, n = 0;
    const lums = [];
    for (let i = 0; i < data.length; i += 4) {
      const L = lum(i);
      if (L < LIT) continue;
      rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; n++;
      lums.push(L);
    }
    // laplacian magnitude over lit pixels = local structure
    let lap = 0, lapN = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        if (lum(i) < LIT) continue;
        const c0 = lum(i);
        const v = 4 * c0
          - lum(i - 4) - lum(i + 4)
          - lum(i - width * 4) - lum(i + width * 4);
        lap += Math.abs(v); lapN++;
      }
    }
    lums.sort((a, b2) => a - b2);
    const pct = (p) => (lums.length ? lums[Math.floor(lums.length * p)] : 0);
    return {
      litFrac: n / (width * height),
      meanR: rs / n, meanG: gs / n, meanB: bs / n,
      redDominance: rs / Math.max(gs, 1),
      detail: lap / Math.max(lapN, 1),
      p50: pct(0.5), p95: pct(0.95), p99: pct(0.99),
      dims: `${width}x${height}`,
    };
  }, `data:image/png;base64,${b64}`);

  console.log(
    path.basename(f).padEnd(22),
    `lit=${(m.litFrac * 100).toFixed(1)}%`.padEnd(11),
    `RGB=${m.meanR.toFixed(1)}/${m.meanG.toFixed(1)}/${m.meanB.toFixed(1)}`.padEnd(24),
    `R:G=${m.redDominance.toFixed(2)}`.padEnd(10),
    `detail=${m.detail.toFixed(2)}`.padEnd(15),
    `p50=${m.p50.toFixed(0)} p95=${m.p95.toFixed(0)} p99=${m.p99.toFixed(0)}`,
  );
}

await browser.close();
