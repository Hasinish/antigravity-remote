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
    // Look for chat container or messages
    const chatFeed = document.querySelector('.jetski-chat-feed, [class*="chat-feed"], [class*="messages"]');
    const allElements = Array.from(document.querySelectorAll('*'));
    
    // Search for attributes containing conversation or jetski
    const jetskiAttrs = [];
    allElements.forEach(el => {
      for (const attr of el.attributes) {
        if (attr.name.includes('conversation') || attr.value.includes('conversation') ||
            attr.name.includes('jetski') || attr.value.includes('jetski')) {
          jetskiAttrs.push({
            tagName: el.tagName,
            className: el.className,
            attrName: attr.name,
            attrValue: attr.value
          });
        }
      }
    });

    return {
      chatFeedClass: chatFeed ? chatFeed.className : 'NOT FOUND',
      chatFeedHtml: chatFeed ? chatFeed.outerHTML.substring(0, 500) : 'NOT FOUND',
      jetskiAttrs: jetskiAttrs.slice(0, 20)
    };
  });

  console.log('DOM Inspection Result:', JSON.stringify(result, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
