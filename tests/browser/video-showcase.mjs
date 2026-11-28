// Run against a demo server: node tests/browser/video-showcase.mjs
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/media/references/') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012');
  const gallery = page.getByRole('region', { name: 'Video inspiration gallery' });
  await gallery.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.video-showcase-card video')].every(video => !video.paused && video.readyState >= 2));
  assert.equal(await gallery.getByRole('button', { name: /pause|resume/i }).count(), 0);
  assert.equal(await gallery.locator('video').evaluateAll(videos => videos.every(video => video.muted && video.loop && video.autoplay && video.playsInline && !video.controls)), true);
  assert.equal(await gallery.locator('.video-showcase-card').count(), 7);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Desktop has no horizontal page overflow');
  await page.screenshot({ path: 'output/video-showcase-desktop.png' });

  const labels = new Set();
  for (let index = 0; index < 10; index++) {
    labels.add(await gallery.locator('.video-showcase-card').first().getAttribute('aria-label'));
    await gallery.getByRole('button', { name: 'Next references' }).click();
  }
  assert.equal(labels.size, 10, 'All ten portrait clips are reachable');
  const first = gallery.locator('.video-showcase-card').first();
  assert.equal(await first.getAttribute('aria-label'), 'Watch Street-style tote', 'Browsing wraps to the beginning');
  await first.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await page.waitForFunction(() => { const video = document.querySelector('dialog[open] video'); return video && !video.paused && video.readyState >= 2; });
  assert.equal(await dialog.locator('video').evaluate(video => video.muted && video.loop && video.autoplay && !video.controls), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await first.evaluate(element => element === document.activeElement), true, 'Closing returns focus to the selected card');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('.video-showcase-card video')].every(video => video.paused));
  await page.setViewportSize({ width: 390, height: 844 });
  await gallery.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile has no horizontal page overflow');
  const rail = gallery.locator('.video-showcase-fan');
  assert.equal(await rail.evaluate(element => element.scrollWidth > element.clientWidth), true, 'Mobile cards have a scrollable rail');
  await rail.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await page.screenshot({ path: 'output/video-showcase-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => [...document.querySelectorAll('.video-showcase-card video')].some(video => !video.paused));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => [...document.querySelectorAll('.video-showcase-card video')].every(video => video.paused));
  assert.deepEqual(failures, []);
  console.log('Passed: all visible videos autoplay silently without controls, ten references, modal autoplay, focus return, reduced motion, mobile scrolling and offscreen pause.');
} finally {
  await browser.close();
}
