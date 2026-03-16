const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('localhost:5173'));
  
  if (!page) {
    console.log("Page not found");
    process.exit(1);
  }

  const sizes = await page.evaluate(() => {
    const block = document.querySelector('.editor-block .tpl-wrapper [contenteditable]');
    if (!block) return "No block";
    
    const span = block.querySelector('span[style*="font-size"]');
    if (!span) return "No span";
    
    const computed = window.getComputedStyle(span);
    return {
      inlineStyle: span.getAttribute('style'),
      computedSize: computed.fontSize,
      parentComputed: window.getComputedStyle(block).fontSize,
      innerHTML: span.outerHTML
    };
  });
  
  console.log(JSON.stringify(sizes, null, 2));
  process.exit(0);
})();
