const puppeteer = require('puppeteer-core');
const fs = require('fs');

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

  console.log('1. Closing stray pickers...');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));

  console.log('2. Clicking history button...');
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

  await page.mouse.click(histCoord.x, histCoord.y);
  await new Promise(r => setTimeout(r, 500));

  // Find a conversation that is NOT the active one, e.g. 9a5e3b0f-b9e3-4e38-b6d2-c6038a4b2e89
  const targetId = '9a5e3b0f-b9e3-4e38-b6d2-c6038a4b2e89';
  console.log(`3. Clicking conversation row for ${targetId}...`);
  
  const rowCoord = await page.evaluate((tid) => {
    const el = document.getElementById(`fastpick-item-${tid}`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, targetId);

  if (!rowCoord) {
    console.error(`Row for ${targetId} not found!`);
    await browser.disconnect();
    return;
  }

  await page.mouse.click(rowCoord.x, rowCoord.y);
  await new Promise(r => setTimeout(r, 800));

  const quickPickInfo = await page.evaluate(() => {
    const widget = document.querySelector('.quick-input-widget');
    if (!widget) return { found: false };
    
    // Get all rows
    const rows = Array.from(widget.querySelectorAll('.monaco-list-row')).map(r => {
      return {
        className: r.className,
        text: (r.innerText || r.textContent || '').trim(),
        html: r.innerHTML
      };
    });

    return {
      found: true,
      display: widget.style.display,
      rowsCount: rows.length,
      rows: rows
    };
  });

  console.log('Quick Pick Info:', JSON.stringify(quickPickInfo, null, 2));

  // Clean up
  await page.keyboard.press('Escape');
  await browser.disconnect();
}

main().catch(console.error);
