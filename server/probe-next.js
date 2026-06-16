const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  console.log(`Found ${pages.length} pages`);

  for (const page of pages) {
    console.log(`\n=== Page: ${page.url().substring(0, 100)} ===`);
    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const text = (el.innerText || el.textContent || '').trim();
          const rect = el.getBoundingClientRect();
          return /next/i.test(text) && text.length < 30 && rect.width > 0 && rect.height > 0;
        })
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            role: el.getAttribute('role') || '',
            cls: el.className.toString().substring(0, 80),
            text: (el.innerText || el.textContent || '').trim(),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
          };
        });
    }).catch(() => []);
    items.forEach(i => console.log(`  y=${i.y} w=${i.w} [${i.tag}] role="${i.role}" | "${i.text}" | ${i.cls}`));
  }

  await browser.disconnect();
})().catch(e => console.error(e.message));
