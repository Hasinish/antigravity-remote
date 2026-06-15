const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('workbench.html'));
  if (!page) {
    console.error('workbench.html not found');
    await browser.disconnect();
    return;
  }

  console.log('[Test] Closing stray pickers...');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));

  console.log('[Test] Looking for history button...');
  const histCoord = await page.evaluate(() => {
    const btn = document.querySelector('a[data-tooltip-id="history-tooltip"]');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });

  if (!histCoord) {
    console.error('History button not found!');
    await browser.disconnect();
    return;
  }

  console.log(`[Test] Clicking history button at ${histCoord.x}, ${histCoord.y}...`);
  await page.mouse.click(histCoord.x, histCoord.y);
  await new Promise(r => setTimeout(r, 500));

  const panelExists = await page.evaluate(() => {
    const el = document.querySelector('.jetski-fast-pick');
    return el ? { className: el.className, html: el.innerHTML.substring(0, 500) } : null;
  });

  console.log('[Test] Panel exists status:', panelExists);

  if (!panelExists) {
    console.error('Panel .jetski-fast-pick did not open!');
    await browser.disconnect();
    return;
  }

  // List all options
  const options = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('.jetski-fast-pick [role="option"]'));
    return opts.map(o => ({
      id: o.getAttribute('id') || '',
      text: (o.innerText || '').trim(),
      className: o.className
    }));
  });

  console.log('[Test] Options in history panel:', options);

  // Take a screenshot
  const screenshotPath = path.resolve('C:\\Users\\Hasin\\.gemini\\antigravity-ide\\scratch\\history-click.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`[Test] Saved screenshot to ${screenshotPath}`);

  await browser.disconnect();
}

main().catch(console.error);
