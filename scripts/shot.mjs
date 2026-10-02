/**
 * shot.mjs — offline capture rig for THE SENTINEL (section 04).
 *
 * Boots the dev server page in headless Chrome with WebGL enabled, scrolls
 * #matrix into view, then writes two PNGs:
 *
 *   <name>.png         cursor parked off-model, shader clock pinned — the
 *                      "at rest" frame, and the only one worth diffing
 *   <name>-threat.png  cursor held on the face, so the threat escalation,
 *                      eye heartbeat and heat pool are all engaged
 *
 * Pinning the clock and the cursor is what makes two captures comparable:
 * without it every shot catches the breathing pulse and the auto-roaming
 * scanner at a different phase, and a diff reports ~30% of pixels changed for
 * any edit at all. Both hooks are DEV-only, so this must run against `vite`,
 * not against a production preview.
 *
 * Usage: node scripts/shot.mjs <name-without-extension> [freezeTime]
 *        PORT=5199 node scripts/shot.mjs /tmp/shots/after
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'shot').replace(/\.png$/, '');
const freeze = process.argv[3] !== undefined ? Number(process.argv[3]) : 6.0;
const PORT = process.env.PORT || 5199;

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=gl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 60000 });

// let the preloader finish, then bring the Sentinel into view so the island boots
await page.waitForTimeout(3500);
await page.evaluate(() => {
  document.getElementById('matrix')?.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(1200);

const stage = await page.$('#sentinelStage');
if (!stage) { console.log('NO #sentinelStage'); await browser.close(); process.exit(1); }

// ---- at rest: clock pinned, cursor parked in the far corner ----
await page.evaluate((f) => {
  window.__sentinelFreeze = f;
  window.__sentinelHold = { x: 0.92, y: 0.92 };
}, freeze);
await page.waitForTimeout(3200);
await stage.screenshot({ path: `${base}.png` });

// ---- under threat: cursor stalking the face ----
// release the pinned cursor so PointerRig tracks the real one, but keep the
// clock pinned so the only difference from the frame above is the threat state
await page.evaluate(() => { window.__sentinelHold = null; });
const box = await stage.boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.waitForTimeout(1600);
await stage.screenshot({ path: `${base}-threat.png` });

const webgl = await page.evaluate(() => {
  const c = document.querySelector('#sentinelRoot canvas');
  if (!c) return 'NO CANVAS';
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return gl ? `${c.width}x${c.height}` : 'NO GL CONTEXT';
});

console.log(`wrote ${base}.png + ${base}-threat.png  canvas=${webgl}`);
if (errors.length) {
  console.log(`\nPAGE ERRORS (${errors.length}):`);
  errors.slice(0, 12).forEach((e) => console.log('  ' + e));
}

await browser.close();
