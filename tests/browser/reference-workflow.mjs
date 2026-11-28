import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.VIDZO_TEST_URL ?? 'http://127.0.0.1:3012/#reference-workflow');
  const section = page.locator('#reference-workflow');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.workflow-demo-columns')).display === 'grid');
  await section.scrollIntoViewIfNeeded();
  assert.equal(await section.locator('.workflow-demo-video-button').count(), 3);
  await page.waitForFunction(() => [...document.querySelectorAll('.workflow-demo-videos video')].every(video => !video.paused && video.readyState >= 2));
  assert.equal(await section.locator('video').evaluateAll(videos => videos.every(video => video.muted && video.loop && video.autoplay && video.playsInline && !video.controls)), true);
  assert.equal(await section.getByRole('button', { name: /pause|play/i }).count(), 0);
  assert.equal(await section.locator('.workflow-demo-columns').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 2);
  for (const name of ['Cat bed', 'Plaid bag', 'Headphones']) {
    const button = section.getByRole('button', { name: `Watch ${name} reference` });
    await button.click();
    const dialog = page.getByRole('dialog', { name: `${name} reference` });
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => { const video = document.querySelector('dialog[open] video'); return video && !video.paused && video.readyState >= 2; });
    assert.equal(await dialog.locator('video').evaluate(video => video.muted && video.loop && !video.controls), true);
    assert.equal(await dialog.locator('video').evaluate(video => video.readyState >= 2 && !video.paused), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
  const downloadEvent = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download example plan' }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'vidzo-example-publishing-plan.txt');
  const stream = await download.createReadStream();
  let plan = '';
  for await (const chunk of stream) plan += chunk.toString();
  assert.match(plan, /Nothing has been generated or scheduled/);
  await section.getByRole('button', { name: 'Edit brief', exact: true }).click();
  const input = section.getByRole('textbox', { name: 'Edit the sample brief' });
  await input.fill('');
  assert.equal(await section.getByRole('button', { name: 'Open this brief' }).isDisabled(), true);
  await input.fill('An original cat-bed campaign with three clearly reviewed scenes.');
  await section.getByRole('button', { name: 'Save brief' }).click();
  assert.equal(await section.getByText('An original cat-bed campaign with three clearly reviewed scenes.').isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await section.locator('.workflow-demo-columns').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await section.locator('.workflow-demo-videos').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.workflow-demo-videos video')].every(video => !video.paused && video.readyState >= 2));
  await page.screenshot({ path: 'output/reference-workflow-mobile-final.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await section.locator('.workflow-demo').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/reference-workflow-desktop-final.png' });
  await section.getByRole('button', { name: 'Open this brief' }).click();
  await page.waitForURL('**/projects?new=1');
  await page.getByRole('textbox', { name: 'Creative direction' }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('textbox', { name: 'Creative direction' }).inputValue(), 'An original cat-bed campaign with three clearly reviewed scenes.');
  assert.deepEqual(errors, []);
  console.log('Passed: responsive layout, three playable references, brief editing, blank-brief protection, plan download and transfer into a real draft.');
} finally {
  await browser.close();
}
