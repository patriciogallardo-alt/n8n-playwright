/**
 * browser-utils.js
 * Utilidades compartidas para todos los scrapers de remesas.
 * Maneja: lanzamiento de browser, stealth, sesiones persistentes, screenshots de debug.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// Aplicar stealth plugin
puppeteer.use(StealthPlugin());

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const SESSIONS_DIR = process.env.SESSIONS_DIR || '/data/sessions';
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || '/data/sessions/screenshots';

// ── Configuración de viewport realista ──
const VIEWPORT = { width: 1920, height: 1080 };

// ── User agents rotativos (Chrome estable en desktop) ──
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

/**
 * Lanza un browser con stealth y sesión persistente.
 * @param {string} serviceName - Nombre del servicio (wu, ria) para aislar sesiones
 * @returns {Promise<{browser: Browser, page: Page}>}
 */
async function launchBrowser(serviceName) {
  const userDataDir = path.join(SESSIONS_DIR, serviceName);
  
  // Asegurar que existe el directorio
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      // Reducir huella de memoria para Railway
      '--single-process',
      '--no-zygote',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await browser.newPage();
  
  // Configurar viewport y user agent
  await page.setViewport(VIEWPORT);
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  await page.setUserAgent(ua);

  // Bloquear recursos innecesarios para acelerar carga
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  return { browser, page };
}

/**
 * Delay aleatorio que simula comportamiento humano.
 * @param {number} min - Milisegundos mínimo
 * @param {number} max - Milisegundos máximo
 */
async function humanDelay(min = 500, max = 2000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Captura screenshot para debugging.
 * @param {Page} page - Página de Puppeteer
 * @param {string} name - Nombre descriptivo del screenshot
 */
async function captureScreenshot(page, name) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.error(`[DEBUG] Screenshot saved: ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`[DEBUG] Screenshot failed: ${err.message}`);
    return null;
  }
}

/**
 * Espera a que un selector esté disponible con timeout configurable.
 * @param {Page} page 
 * @param {string} selector 
 * @param {number} timeout - ms (default 30000)
 */
async function waitForSelector(page, selector, timeout = 30000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Intenta cerrar cookie banners comunes.
 * @param {Page} page 
 */
async function dismissCookieBanner(page) {
  const cookieSelectors = [
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="cookie"]',
    '[data-testid="cookie-accept"]',
    '.cookie-consent-accept',
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept")',
    'button:has-text("Aceptar")',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await humanDelay(500, 1000);
        console.error(`[DEBUG] Cookie banner dismissed: ${selector}`);
        return true;
      }
    } catch {
      // Continuar al siguiente selector
    }
  }
  return false;
}

/**
 * Parsea argumentos desde CLI. Espera JSON como primer argumento.
 * @returns {Object} Argumentos parseados
 */
function parseArgs() {
  const raw = process.argv[2];
  if (!raw) {
    console.error(JSON.stringify({ error: 'No arguments provided. Usage: node script.js \'{"country":"VE","amount":100000}\'' }));
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(JSON.stringify({ error: `Invalid JSON arguments: ${err.message}` }));
    process.exit(1);
  }
}

/**
 * Output estándar: imprime resultado como JSON por stdout.
 * Toda otra info va por stderr para no contaminar el output.
 * @param {Object} data 
 */
function outputResult(data) {
  console.log(JSON.stringify(data));
}

/**
 * Output de error estándar.
 * @param {string} message 
 * @param {Object} details 
 */
function outputError(message, details = {}) {
  console.log(JSON.stringify({ 
    error: true, 
    message, 
    ...details,
    timestamp: new Date().toISOString() 
  }));
}

module.exports = {
  launchBrowser,
  humanDelay,
  captureScreenshot,
  waitForSelector,
  dismissCookieBanner,
  parseArgs,
  outputResult,
  outputError,
};
