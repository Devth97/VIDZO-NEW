import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012/#how');
  const timeline = page.locator('.dino-timeline');
  await timeline.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.dino-timeline')?.dataset.running === 'true');
  const rider = timeline.locator('.timeline-rider');
  const before = await rider.getAttribute('style');
  await page.waitForTimeout(400);
  assert.notEqual(await rider.getAttribute('style'), before, 'Dinosaur travels along the timeline');
  assert.equal(await timeline.locator('.dino-body').evaluate(element => getComputedStyle(element).animationPlayState), 'running');
  await timeline.getByRole('button', { name: 'Pause the walkthrough' }).click();
  await page.waitForFunction(() => document.querySelector('.dino-timeline')?.dataset.running === 'false');
  const paused = await rider.getAttribute('style');
  await page.waitForTimeout(400);
  assert.equal(await rider.getAttribute('style'), paused, 'Pause freezes position');
  assert.equal(await timeline.locator('.dino-body').evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
  await timeline.getByRole('button', { name: 'Show step 3: Review & produce' }).click();
  assert.equal(await timeline.locator('.step-cards > li').nth(2).getAttribute('class'), 'is-active');
  assert.match(await timeline.locator('.timeline-clock').innerText(), /00:08/);
  await page.screenshot({ path: 'output/dinosaur-timeline-desktop.png' });
  await timeline.getByRole('button', { name: 'Play the walkthrough' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('.dino-timeline')?.dataset.running === 'false');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const offscreen = await rider.getAttribute('style');
  await page.waitForTimeout(300);
  assert.equal(await rider.getAttribute('style'), offscreen, 'Offscreen work pauses');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await timeline.scrollIntoViewIfNeeded();
  await timeline.getByRole('button', { name: 'Play the walkthrough' }).waitFor();
  assert.equal(await timeline.locator('.dino-body').evaluate(element => getComputedStyle(element).animationName), 'none');
  assert.equal(await timeline.getAttribute('data-running'), 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await timeline.locator('.timeline-bar').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'output/dinosaur-timeline-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Passed: running dinosaur, leg animation, pause/resume, stage selection, offscreen pause, reduced motion and mobile fit.');
} finally {
  await browser.close();
}
