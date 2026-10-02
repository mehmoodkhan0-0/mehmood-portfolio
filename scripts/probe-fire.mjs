/**
 * probe-fire.mjs — does pressing on the skull actually commit a burn mark?
 *
 * Boots the dev server page, scrolls the Sentinel into view, then presses and
 * holds on the centre of the stage (where the skull is) and releases. Reports
 * any exception thrown during the release path plus the resulting burn count.
 */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=gl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto(`http://localhost:${process.env.PORT || 5199}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3500);
await page.evaluate(() => document.getElementById('matrix')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(2500);

const box = await (await page.$('#sentinelStage')).boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// press and hold on the skull, then release — this is the burn-commit path
await page.mouse.move(cx, cy);
await page.waitForTimeout(300);
await page.mouse.down();
await page.waitForTimeout(900);
await page.mouse.up();
await page.waitForTimeout(600);

// did a mark actually land? uBurnCount is what the fragment shader walks.
const burn = await page.evaluate(() => {
  const m = window.__skullMat;
  if (!m) return 'NO MATERIAL';
  const u = m.uniforms;
  return {
    burnCount: u.uBurnCount.value,
    data: u.uBurnData.value.slice(0, 2).map((v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]),
    pos: u.uBurnPos.value.slice(0, 1).map((v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]),
  };
});

console.log(`pressed at (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
console.log('burn state:', JSON.stringify(burn));
console.log(`errors captured: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  ' + e.split('\n')[0]));

await browser.close();
