import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012');
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  for (const width of [320, 390, 768, 1024, 1440, 1920, 2880]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.locator('.public-header, .idea-composer, .format-card, .spotlight-card, .workflow-demo, .price-preview-card, .editorial-final').evaluateAll(elements => elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
    }).map(element => element.className));
    assert.deepEqual(overflow, [], `Public surfaces fit at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  assert.equal(await page.getByRole('navigation', { name: 'Main' }).isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate(element => element === document.activeElement), true);
  const formats = page.locator('#formats');
  await formats.scrollIntoViewIfNeeded();
  await formats.getByRole('button', { name: 'Launch', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.format-card').length === 2);
  await formats.getByRole('button', { name: 'All formats', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.format-card').length === 6);
  const question = page.locator('#faq summary').first();
  await question.click();
  assert.equal(await question.evaluate(element => element.parentElement.open), true);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const accessibility = await new AxeBuilder({ page }).include('.public-frame').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(accessibility.violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })), [], `Accessibility scan at ${width}px`);
  }
  assert.deepEqual(errors, []);

  // Marketing copy and formats remain available before JavaScript hydrates.
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  await staticPage.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012');
  assert.equal(await staticPage.getByRole('heading', { level: 1 }).isVisible(), true);
  assert.equal(await staticPage.locator('.format-card').count(), 6);
  assert.equal(await staticPage.locator('.format-card').first().evaluate(element => getComputedStyle(element).opacity), '1');
  console.log('Passed: seven responsive widths, mobile menu/keyboard focus, format filtering, FAQ, desktop/mobile accessibility scans, runtime checks and readable server-rendered content.');
} finally {
  await browser.close();
}
