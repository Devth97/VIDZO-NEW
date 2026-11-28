import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const shader = page.locator('.grain-glow');
  await page.waitForFunction(() => document.querySelector('.grain-glow')?.dataset.motion === 'running');
  assert.equal(await shader.getAttribute('data-shader'), 'ready');
  const time = () => shader.evaluate(canvas => {
    const gl = canvas.getContext('webgl'), program = gl.getParameter(gl.CURRENT_PROGRAM);
    return gl.getUniform(program, gl.getUniformLocation(program, 't'));
  });
  const first = await time();
  await page.waitForTimeout(400);
  assert.ok(await time() > first, 'Shader draws new animated frames');
  const beam = page.locator('.idea-composer .ui-border-beam-light');
  const offset = await beam.evaluate(el => getComputedStyle(el).offsetDistance);
  await page.waitForTimeout(200);
  assert.notEqual(await beam.evaluate(el => getComputedStyle(el).offsetDistance), offset);
  const section = page.locator('#creative-playground');
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.grain-glow')?.dataset.motion === 'offscreen');
  await page.waitForFunction(() => document.querySelector('.particle-title')?.dataset.ready === 'true');
  for (const [label, id] of [['The detail', 'headphone-detail'], ['The transformation', 'cat-bed'], ['The everyday moment', 'checkered-mug']]) {
    const button = section.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const video = section.locator('video');
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(id => {
      const v = document.querySelector('#creative-playground video');
      return v?.src.endsWith(`${id}.mp4`) && !v.paused && v.readyState >= 2;
    }, id);
    assert.deepEqual(await video.evaluate(v => ({ muted: v.muted, loop: v.loop, controls: v.controls })), { muted: true, loop: true, controls: false });
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await section.getByRole('button', { name: 'Use this direction', exact: true }).click();
  await page.waitForURL('**/projects?new=1');
  const direction = page.getByRole('textbox', { name: 'Creative direction' });
  await direction.waitFor();
  assert.match(await direction.inputValue(), /checkered ceramic mug/);
  await page.goto(url);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.grain-glow')?.dataset.motion === 'static');
  const still = await time();
  await page.waitForTimeout(200);
  assert.equal(await time(), still);
  assert.deepEqual(errors, []);

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await fallback.goto(url);
  await fallback.waitForFunction(() => document.querySelector('.grain-glow')?.dataset.shader === 'fallback');
  assert.equal(await fallback.getByRole('heading', { level: 1 }).isVisible(), true);
  assert.equal(await fallback.getByRole('textbox', { name: 'Describe your ad' }).isVisible(), true);
  console.log('Passed: live shader and border motion, offscreen suspension, three silent video directions, responsive fit, real draft handoff, reduced motion and WebGL fallback.');
} finally { await browser.close(); }
