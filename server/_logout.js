const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  for (const page of pages) {
    const found = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('a, button'))
        .find(e => /next/i.test((e.innerText || e.textContent || '').trim()));
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: (el.innerText || '').trim() };
    }).catch(() => null);
    if (found) {
      console.log('Found on:', page.url().substring(0, 80), '| text:', found.text);
      await page.mouse.click(found.x, found.y);
      console.log('Clicked!');
      break;
    }
  }
  await browser.disconnect();
})().catch(e => console.error(e.message));
