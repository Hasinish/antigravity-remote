const puppeteer = require('puppeteer-core');
(async () => {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9975', defaultViewport: null });
    const pages = await browser.pages();
    console.log('Pages at 9975:');
    for (const p of pages) {
      console.log(' -', p.url().substring(0, 120));
    }
    await browser.disconnect();
  } catch (e) {
    console.log('9975 not puppeteer-compatible:', e.message.substring(0, 100));
  }

  // Also try raw HTTP to see what the endpoint says
  const http = require('http');
  http.get('http://localhost:9975/json', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => console.log('9975 /json:', data.substring(0, 500)));
  }).on('error', e => console.log('9975 /json error:', e.message));
})();
