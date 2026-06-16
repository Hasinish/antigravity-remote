const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('workbench.html'));
  if (!page) { console.log('workbench page not found'); process.exit(1); }

  const result = await page.evaluate(() => {
    // Dump everything inside .context-view containers
    const contextViews = Array.from(document.querySelectorAll('.context-view'));
    return contextViews.map(cv => ({
      cls: cv.className,
      items: Array.from(cv.querySelectorAll('*')).map(e => ({
        tag: e.tagName,
        role: e.getAttribute('role') || '',
        cls: e.className.toString().substring(0, 80),
        text: (e.innerText || e.textContent || '').trim().substring(0, 100),
        y: Math.round(e.getBoundingClientRect().top),
        w: Math.round(e.getBoundingClientRect().width),
      })).filter(e => e.text.length > 0 && e.text.length < 100)
        .filter((v, i, a) => a.findIndex(x => x.text === v.text) === i)
        .sort((a, b) => a.y - b.y)
    }));
  });

  for (const cv of result) {
    console.log(`\n=== context-view: ${cv.cls} ===`);
    cv.items.forEach(i => console.log(`  y=${i.y} w=${i.w} [${i.tag}] role="${i.role}" | "${i.text}" | ${i.cls}`));
  }

  await browser.disconnect();
})().catch(e => console.error(e.message));
