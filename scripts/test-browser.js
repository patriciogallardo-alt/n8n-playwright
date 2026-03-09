/**
 * test-browser.js
 * Script de verificación: confirma que Chromium + Puppeteer funcionan correctamente.
 * 
 * USO: node test-browser.js
 * 
 * Si todo está bien, imprime: {"status":"ok","chromium":"working","version":"..."}
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
      ],
    });

    const page = await browser.newPage();
    
    // Test 1: Navegar a una página simple
    await page.goto('https://httpbin.org/get', { timeout: 15000 });
    const content = await page.content();
    const hasContent = content.includes('httpbin');

    // Test 2: Obtener versión del browser
    const version = await browser.version();

    // Test 3: Verificar stealth (webdriver flag)
    const isWebdriver = await page.evaluate(() => navigator.webdriver);

    console.log(JSON.stringify({
      status: 'ok',
      chromium: hasContent ? 'working' : 'page load failed',
      version: version,
      stealth: isWebdriver === false ? 'active (webdriver hidden)' : 'NOT active',
      timestamp: new Date().toISOString(),
    }));

  } catch (err) {
    console.log(JSON.stringify({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString(),
    }));
  } finally {
    if (browser) await browser.close();
  }
}

main();
