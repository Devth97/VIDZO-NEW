import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012');
  for (const width of [320, 390, 768, 1024, 1100, 1200, 1440, 1920, 2880]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.hero-art img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}px`);
    const surfaces = await page.locator('.hero-art, .idea-composer').evaluateAll(elements => elements.map(el => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    }));
    for (const surface of surfaces) assert.ok(surface.left >= 0 && surface.right <= width, `Unclipped art and composer at ${width}px`);
    const [left, right, form] = surfaces;
    assert.ok(left.right <= form.left || left.bottom <= form.top, 'Left artwork does not cover the composer');
    assert.ok(right.left >= form.right || right.bottom <= form.top, 'Right artwork does not cover the composer');
  }
  assert.match(await page.locator('.hero-art-note').innerText(), /Not a VIDZO video result/);
  await page.setViewportSize({ width: 390, height: 844 });
  const input = page.getByRole('textbox', { name: 'Describe your ad' });
  await input.fill('A citrus drink launch with bright natural light and original scenes.');
  await page.getByRole('button', { name: 'Start my free draft', exact: true }).click();
  await page.waitForURL('**/projects?new=1');
  const direction = page.getByRole('textbox', { name: 'Creative direction' });
  await direction.waitFor();
  assert.match(await direction.inputValue(), /citrus drink launch/);
  assert.deepEqual(errors, []);
  console.log('Passed: nine widths, decoded responsive images, no art/form overlap, honest concept labeling and mobile draft handoff.');
} finally { await browser.close(); }
