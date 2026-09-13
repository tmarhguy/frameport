const { chromium } = require('@playwright/test');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync, existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { renderView } = require('../src/view');
const assert = require('node:assert/strict');
(async () => {
  const jpeg = execFileSync(process.env.FRAMEPORT_TEST_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=1', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1']);
  let sequence = 0;
  const server = createServer((request, response) => {
    if (request.url === '/frame') { response.setHeader('Content-Type', 'image/jpeg'); response.setHeader('ETag', `"${++sequence}"`); response.end(jpeg); return; }
    if (request.url === '/preview.js' || request.url === '/preview.css') { response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(readFileSync(`media${request.url}`)); return; }
    const origin = `http://127.0.0.1:${server.address().port}`;
    response.setHeader('Content-Type', 'text/html');
    response.end(renderView({ nonce: 'testing', script: '/preview.js', style: '/preview.css', origin, cspSource: origin }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const local = `${require('node:os').homedir()}/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium`;
    browser = await chromium.launch({ headless: true, ...(existsSync(local) ? { executablePath: local } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.messages = []; window.acquireVsCodeApi = () => ({ getState: () => ({}), setState() {}, postMessage: message => window.messages.push(message) }); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/preview-idle.png' });
    await page.evaluate(() => {
      document.body.classList.add('vscode-light');
      const tokens = { 'editor-background': '#ffffff', foreground: '#333333', descriptionForeground: '#616161', 'panel-border': '#e5e5e5', 'dropdown-background': '#ffffff', 'dropdown-foreground': '#333333', 'dropdown-border': '#cecece', 'toolbar-hoverBackground': '#dddddd', disabledForeground: '#767676' };
      for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--vscode-${key}`, value);
    });
    assert.equal(await page.locator('#empty').evaluate(el => getComputedStyle(el).color), 'rgb(51, 51, 51)');
    await page.screenshot({ path: 'artifacts/preview-light.png' });
    await page.evaluate(() => { document.documentElement.removeAttribute('style'); document.body.classList.remove('vscode-light'); });
    await page.evaluate(() => {
      document.body.classList.add('vscode-high-contrast');
      const tokens = { 'editor-background': '#000000', foreground: '#ffffff', descriptionForeground: '#ffffff', 'panel-border': '#6fc3df', 'dropdown-background': '#000000', 'dropdown-foreground': '#ffffff', 'dropdown-border': '#6fc3df', 'toolbar-hoverBackground': '#222222', disabledForeground: '#999999', contrastBorder: '#6fc3df', focusBorder: '#f48771' };
      for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--vscode-${key}`, value);
    });
    assert.equal(await page.locator('#empty').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
    await page.screenshot({ path: 'artifacts/preview-high-contrast.png' });
    await page.evaluate(() => { document.documentElement.removeAttribute('style'); document.body.classList.remove('vscode-high-contrast'); });
    const post = message => page.evaluate(message => window.postMessage(message, '*'), message);
    await post({ type: 'stream', url: `${origin}/frame` });
    await post({ type: 'state', phase: 'streaming', text: 'Test pattern · Requested 320 × 240' });
    await page.waitForFunction(() => !document.querySelector('canvas').hidden);
    await page.selectOption('#scaling', 'integer');
    assert.equal(await page.locator('canvas').evaluate(el => el.clientWidth % el.width), 0);
    await post({ type: 'recording', phase: 'recording', startedAt: Date.now() - 2000 });
    await page.waitForFunction(() => document.querySelector('#record').textContent === 'Stop recording');
    assert.equal(await page.locator('#record-status').isVisible(), true);
    await page.locator('#focus').click();
    assert.equal(await page.locator('#record-badge').isVisible(), true);
    assert.match(await page.locator('#record-badge').textContent(), /Recording/);
    await page.screenshot({ path: 'artifacts/preview-focus-recording.png' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#record-badge').isVisible(), false);
    await page.locator('#record').click();
    assert.ok(await page.evaluate(() => window.messages.some(message => message.command === 'record')));
    await post({ type: 'recording', phase: 'saved' });
    await post({ type: 'selection', device: 'Capture screen 0', mode: '1280 × 720 · 30 fps', screen: true, fps: 30 });
    assert.equal(await page.locator('#mode').isDisabled(), false);
    assert.equal(await page.locator('#mode').textContent(), 'Native size · 30 fps');
    await page.locator('#mode').click();
    assert.ok(await page.evaluate(() => window.messages.some(message => message.command === 'mode')));
    await page.evaluate(() => { window.messages.length = 0; });
    // Oversized screenshots refuse before allocating/transferring a huge PNG.
    // Freeze first so the live tick does not reset the canvas dimensions.
    await page.locator('#pause').click();
    await page.evaluate(() => { const canvas = document.querySelector('#preview'); canvas.width = 10000; canvas.height = 10000; });
    await page.locator('#screenshot').click();
    assert.ok(await page.evaluate(() => window.messages.some(message => message.command === 'screenshotTooLarge' && message.width === 10000)));
    assert.ok(await page.evaluate(() => !window.messages.some(message => message.command === 'saveScreenshot')));
    await page.evaluate(() => { const canvas = document.querySelector('#preview'); canvas.width = 320; canvas.height = 240; window.messages.length = 0; });
    await page.locator('#pause').click();
    await post({ type: 'selection', device: 'USB Video', mode: '1280 × 720 · 30 fps', screen: false });
    assert.equal(await page.locator('#mode').isDisabled(), false);
    assert.equal(await page.locator('#mode').textContent(), '1280 × 720 · 30 fps');
    await page.locator('#pause').click();
    assert.equal(await page.locator('#paused').isVisible(), true);
    await page.locator('#screenshot').click();
    assert.ok(await page.evaluate(() => window.messages.some(message => message.command === 'saveScreenshot' && message.data.startsWith('data:image/png;base64,'))));
    await page.locator('#pause').click();
    await page.selectOption('#scaling', 'fit');
    await page.screenshot({ path: 'artifacts/preview-live.png' });
    await page.locator('#focus').click();
    assert.equal(await page.locator('header').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('header').isVisible(), true);
    await page.setViewportSize({ width: 360, height: 720 });
    await page.screenshot({ path: 'artifacts/preview-narrow.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await post({ type: 'state', phase: 'stopped', text: 'Stopped' });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('canvas').isVisible(), false);
    assert.equal(await page.locator('#screenshot').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('UI checks passed: live rendering, integer scaling, pause, PNG screenshot, oversized-screenshot refusal, focus, focus recording badge, screen FPS control, light/high-contrast/narrow layouts, stop cleanup.');
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
