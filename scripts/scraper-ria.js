/**
 * scraper-ria.js
 * Scraper de RIA Money Transfer para remesas desde Chile.
 * 
 * USO:
 *   node scraper-ria.js '{"country":"VE","amount":100000,"email":"x@y.com","password":"***"}'
 * 
 * OUTPUT (stdout): JSON con datos de la remesa
 * DEBUG (stderr): Logs y screenshots
 */

const {
  launchBrowser,
  humanDelay,
  captureScreenshot,
  waitForSelector,
  dismissCookieBanner,
  parseArgs,
  outputResult,
  outputError,
} = require('./browser-utils');

// ══════════════════════════════════════════════════════════
// CONFIGURACIÓN ESPECÍFICA DE RIA
// ══════════════════════════════════════════════════════════

const RIA_BASE_URL = 'https://www.riamoneytransfer.com/cl';
const RIA_LOGIN_URL = `${RIA_BASE_URL}/iniciar-sesion`;
const RIA_SEND_URL = `${RIA_BASE_URL}/`;

const COUNTRY_MAP = {
  VE: { name: 'Venezuela', code: 'VE', currency: 'VES' },
  PE: { name: 'Perú', code: 'PE', currency: 'PEN' },
  HT: { name: 'Haití', code: 'HT', currency: 'HTG' },
  CO: { name: 'Colombia', code: 'CO', currency: 'COP' },
  BR: { name: 'Brasil', code: 'BR', currency: 'BRL' },
  AR: { name: 'Argentina', code: 'AR', currency: 'ARS' },
};

// ══════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ══════════════════════════════════════════════════════════

async function isLoggedIn(page) {
  try {
    await page.goto(RIA_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 3000);

    // ⚠️ SELECTORES A CONFIRMAR con discovery mode
    const loggedInIndicators = [
      '[data-testid="user-profile"]',
      '.user-menu',
      '.account-icon',
      'a[href*="mi-cuenta"]',
      'a[href*="account"]',
    ];

    for (const selector of loggedInIndicators) {
      const el = await page.$(selector);
      if (el) {
        console.error('[RIA] Session active');
        return true;
      }
    }

    console.error('[RIA] No active session');
    return false;
  } catch (err) {
    console.error(`[RIA] Login check error: ${err.message}`);
    return false;
  }
}

async function login(page, email, password) {
  console.error('[RIA] Starting login flow...');
  
  try {
    await page.goto(RIA_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);
    await dismissCookieBanner(page);
    await humanDelay(1000, 2000);

    await captureScreenshot(page, 'ria-login-page');

    // ⚠️ SELECTORES DE LOGIN (PLACEHOLDERS - usar discovery)
    const LOGIN_SELECTORS = {
      emailInput: 'input[type="email"], input[name="email"], #email',
      passwordInput: 'input[type="password"], input[name="password"], #password',
      submitButton: 'button[type="submit"], .login-submit',
    };

    const emailFound = await waitForSelector(page, LOGIN_SELECTORS.emailInput);
    if (!emailFound) {
      await captureScreenshot(page, 'ria-login-no-email-field');
      throw new Error('Email input not found');
    }

    await page.type(LOGIN_SELECTORS.emailInput, email, { delay: 50 + Math.random() * 100 });
    await humanDelay(500, 1000);
    await page.type(LOGIN_SELECTORS.passwordInput, password, { delay: 50 + Math.random() * 100 });
    await humanDelay(500, 1500);

    await captureScreenshot(page, 'ria-login-before-submit');
    await page.click(LOGIN_SELECTORS.submitButton);
    
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);

    await captureScreenshot(page, 'ria-login-after-submit');
    console.error('[RIA] Login completed');
    return true;

  } catch (err) {
    await captureScreenshot(page, 'ria-login-error');
    console.error(`[RIA] Login failed: ${err.message}`);
    return false;
  }
}

async function extractRemittanceData(page, countryCode, amount) {
  const country = COUNTRY_MAP[countryCode];
  if (!country) throw new Error(`Unknown country code: ${countryCode}`);

  console.error(`[RIA] Extracting data for ${country.name}, amount: ${amount} CLP`);

  try {
    await page.goto(RIA_SEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);
    await dismissCookieBanner(page);

    await captureScreenshot(page, `ria-send-page-${countryCode}`);

    // ══════════════════════════════════════════════════════
    // ⚠️  SELECTORES - REQUIERE DISCOVERY
    // ══════════════════════════════════════════════════════
    //
    // PATRÓN TÍPICO DE RIA:
    //   - Dropdown para país destino (puede ser en la home page)
    //   - Input para monto a enviar
    //   - Calculadora muestra resultado inline
    //   - Opciones de método de envío/recepción
    //

    // TODO: Implementar selección de país + monto
    // TODO: Implementar espera de resultados
    // TODO: Implementar extracción DOM

    await humanDelay(3000, 5000);
    await captureScreenshot(page, `ria-results-${countryCode}-${amount}`);

    const data = await page.evaluate(() => {
      return {
        _placeholder: true,
        _message: 'SELECTORES NO CONFIGURADOS. Ejecutar en modo discovery primero.',
        exchange_rate: null,
        fee_base: null,
        fee_tax: null,
        amount_received: null,
        payment_methods: [],
        delivery_methods: [],
      };
    });

    return data;

  } catch (err) {
    await captureScreenshot(page, `ria-extract-error-${countryCode}`);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════
// MODO DISCOVERY
// ══════════════════════════════════════════════════════════

async function runDiscovery(page, email, password) {
  console.error('[RIA] Running in DISCOVERY mode...');
  
  const screenshots = [];

  await page.goto(RIA_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(3000, 5000);
  await dismissCookieBanner(page);
  screenshots.push(await captureScreenshot(page, 'discovery-ria-home'));

  const loggedIn = await login(page, email, password);
  screenshots.push(await captureScreenshot(page, 'discovery-ria-post-login'));

  await page.goto(RIA_SEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(3000, 5000);
  screenshots.push(await captureScreenshot(page, 'discovery-ria-send-page'));

  const domInfo = await page.evaluate(() => {
    const elements = [];
    document.querySelectorAll('input, select, button, [role="button"], [role="combobox"], [role="listbox"]').forEach(el => {
      elements.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        name: el.name || null,
        type: el.type || null,
        class: el.className ? el.className.substring(0, 100) : null,
        text: el.textContent ? el.textContent.trim().substring(0, 50) : null,
        placeholder: el.placeholder || null,
        testId: el.dataset?.testid || null,
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
      });
    });
    return elements;
  });

  return {
    mode: 'discovery',
    logged_in: loggedIn,
    screenshots,
    dom_elements: domInfo,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════

async function main() {
  const args = parseArgs();
  let browser, page;

  try {
    ({ browser, page } = await launchBrowser('ria'));

    if (args.mode === 'discovery') {
      const result = await runDiscovery(page, args.email, args.password);
      outputResult(result);
      return;
    }

    const { country, amount, email, password } = args;
    
    if (!country || !amount || !email || !password) {
      outputError('Missing required args: country, amount, email, password');
      return;
    }

    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      const loginOk = await login(page, email, password);
      if (!loginOk) {
        outputError('Login failed', { country, amount });
        return;
      }
    }

    const data = await extractRemittanceData(page, country, amount);

    const result = {
      timestamp: new Date().toISOString(),
      agent: 'RIA',
      country_dest: COUNTRY_MAP[country]?.name || country,
      currency_origin: 'CLP',
      currency_dest: COUNTRY_MAP[country]?.currency || 'USD',
      amount_sent: amount,
      amount_received: data.amount_received,
      exchange_rate: data.exchange_rate,
      fee_base: data.fee_base,
      fee_tax: data.fee_tax,
      total_charged: amount + (data.fee_base || 0) + (data.fee_tax || 0),
      payment_methods: data.payment_methods,
      delivery_methods: data.delivery_methods,
    };

    outputResult(result);

  } catch (err) {
    if (page) await captureScreenshot(page, 'ria-fatal-error');
    outputError(err.message, { country: args.country, amount: args.amount });
  } finally {
    if (browser) await browser.close();
  }
}

main();
