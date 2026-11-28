// Regression check: cards must fit every clipping ancestor, including the page wrapper.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012');
  for (const width of [768, 1024, 1280, 1440, 1599, 1600, 1920, 2304, 2880]) {
    await page.setViewportSize({ width, height: 1100 });
    const clipped = await page.locator('.video-showcase-card').evaluateAll(cards => cards.flatMap(card => {
      const bounds = card.getBoundingClientRect();
      const problems = [];
      for (let ancestor = card.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const overflow = getComputedStyle(ancestor).overflowX;
        if (!['hidden', 'clip', 'auto', 'scroll'].includes(overflow)) continue;
        const clip = ancestor.getBoundingClientRect();
        if (bounds.left < clip.left - 1 || bounds.right > clip.right + 1) {
          problems.push(`${card.getAttribute('aria-label')} clipped by ${ancestor.className}`);
        }
      }
      return problems;
    }));
    assert.deepEqual(clipped, [], `All seven cards must be fully visible at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.locator('.video-showcase').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/video-showcase-unclipped.png' });
  console.log('Passed: all seven cards fit their clipping ancestors at nine desktop widths, including zoom-equivalent viewports.');
} finally {
  await browser.close();
}
