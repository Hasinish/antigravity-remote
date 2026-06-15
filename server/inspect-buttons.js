const puppeteer = require('puppeteer-core');

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

  const result = await page.evaluate(() => {
    const elList = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
    return elList.map(el => {
      const tooltip = el.getAttribute('data-tooltip-id') || '';
      const label = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const text = el.innerText || '';
      return {
        tagName: el.tagName,
        className: el.className,
        text: text.substring(0, 50),
        dataTooltipId: tooltip,
        ariaLabel: label,
        title: title
      };
    }).filter(item => {
      const term = (item.dataTooltipId + ' ' + item.ariaLabel + ' ' + item.title + ' ' + item.text).toLowerCase();
      return term.includes('history') || term.includes('conversation') || term.includes('new') || term.includes('jetski') || term.includes('fast');
    });
  });

  console.log('Filtered Elements:');
  console.log(JSON.stringify(result, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
