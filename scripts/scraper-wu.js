/**
 * scraper-wu.js
 * Scraper de Western Union para remesas desde Chile.
 * 
 * USO:
 *   node scraper-wu.js '{"country":"VE","amount":100000,"email":"x@y.com","password":"***"}'
 * 
 * OUTPUT (stdout): JSON con datos de la remesa
 * DEBUG (stderr): Logs y screenshots
 * 
 * FLUJO:
 *   1. Lanzar browser con sesión persistente
 *   2. Verificar si hay sesión activa → si no, hacer login
 *   3. Navegar a la calculadora de envío
 *   4. Seleccionar país destino + ingresar monto
 *   5. Extraer: tasa, fees, monto recibido, métodos
 *   6. Output JSON
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
// CONFIGURACIÓN ESPECÍFICA DE WESTERN UNION
// ══════════════════════════════════════════════════════════

const WU_BASE_URL = 'https://www.westernunion.com/cl/es';
const WU_LOGIN_URL = `${WU_BASE_URL}/home.html`;
const WU_SEND_URL = `${WU_BASE_URL}/send-money/app/start`;

// Mapeo de códigos ISO a nombres de país en WU
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

/**
 * Verifica si el usuario está logueado.
 * Indicadores: presencia de menú de usuario, ausencia de botón "Iniciar sesión".
 * 
 * ⚠️ IMPORTANTE: Estos selectores deben verificarse manualmente antes del primer uso.
 *    Ejecutar primero: node scraper-wu.js '{"mode":"discovery","email":"...","password":"..."}'
 */
async function isLoggedIn(page) {
  try {
    // Navegar a la página principal para verificar estado
    await page.goto(WU_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 3000);

    // ── SELECTORES A CONFIRMAR ──
    // Estos selectores son aproximados y deben validarse con el modo discovery.
    // Buscar indicador de usuario logueado (ej: ícono de perfil, nombre, menú)
    const loggedInIndicators = [
      '[data-testid="user-menu"]',
      '.user-profile-icon',
      '.logged-in-nav',
      'a[href*="profile"]',
      'a[href*="account"]',
    ];

    for (const selector of loggedInIndicators) {
      const el = await page.$(selector);
      if (el) {
        console.error('[WU] Session active - user is logged in');
        return true;
      }
    }

    console.error('[WU] No active session found');
    return false;
  } catch (err) {
    console.error(`[WU] Login check error: ${err.message}`);
    return false;
  }
}

/**
 * Realiza login en Western Union.
 * 
 * ⚠️ SELECTORES: Deben confirmarse con discovery mode antes del primer uso.
 */
async function login(page, email, password) {
  console.error('[WU] Starting login flow...');
  
  try {
    await page.goto(WU_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);
    await dismissCookieBanner(page);
    await humanDelay(1000, 2000);

    // ── CAPTURAR SCREENSHOT PARA DEBUGGING ──
    await captureScreenshot(page, 'wu-login-page');

    // ── SELECTORES DE LOGIN (A CONFIRMAR) ──
    // Estos selectores son placeholders. Usar discovery mode para obtener los reales.
    const LOGIN_SELECTORS = {
      // Botón para abrir modal/página de login
      loginButton: 'a[href*="sign-in"], button[data-testid="login-btn"], .login-link',
      // Campos del formulario
      emailInput: 'input[type="email"], input[name="email"], #email',
      passwordInput: 'input[type="password"], input[name="password"], #password',
      // Botón submit
      submitButton: 'button[type="submit"], button[data-testid="submit-btn"]',
    };

    // Paso 1: Click en "Iniciar sesión" si es necesario
    const loginBtn = await page.$(LOGIN_SELECTORS.loginButton);
    if (loginBtn) {
      await loginBtn.click();
      await humanDelay(2000, 3000);
    }

    // Paso 2: Llenar email
    const emailFound = await waitForSelector(page, LOGIN_SELECTORS.emailInput);
    if (!emailFound) {
      await captureScreenshot(page, 'wu-login-no-email-field');
      throw new Error('Email input not found');
    }
    await page.type(LOGIN_SELECTORS.emailInput, email, { delay: 50 + Math.random() * 100 });
    await humanDelay(500, 1000);

    // Paso 3: Llenar password
    await page.type(LOGIN_SELECTORS.passwordInput, password, { delay: 50 + Math.random() * 100 });
    await humanDelay(500, 1500);

    // Paso 4: Submit
    await captureScreenshot(page, 'wu-login-before-submit');
    await page.click(LOGIN_SELECTORS.submitButton);
    
    // Paso 5: Esperar navegación post-login
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);

    await captureScreenshot(page, 'wu-login-after-submit');
    console.error('[WU] Login completed');
    return true;

  } catch (err) {
    await captureScreenshot(page, 'wu-login-error');
    console.error(`[WU] Login failed: ${err.message}`);
    return false;
  }
}

/**
 * Navega a la calculadora y extrae datos de la remesa.
 * 
 * ⚠️ SELECTORES: Deben confirmarse con discovery mode.
 */
async function extractRemittanceData(page, countryCode, amount) {
  const country = COUNTRY_MAP[countryCode];
  if (!country) {
    throw new Error(`Unknown country code: ${countryCode}`);
  }

  console.error(`[WU] Extracting data for ${country.name}, amount: ${amount} CLP`);

  try {
    // ── Navegar a la página de envío ──
    await page.goto(WU_SEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(2000, 4000);
    await dismissCookieBanner(page);

    await captureScreenshot(page, `wu-send-page-${countryCode}`);

    // ══════════════════════════════════════════════════════
    // ⚠️  SECCIÓN DE SELECTORES - REQUIERE DISCOVERY
    // ══════════════════════════════════════════════════════
    // 
    // Los selectores a continuación son PLACEHOLDERS.
    // Antes de la primera ejecución real:
    //   1. Navegar manualmente a WU y documentar la UI
    //   2. Ejecutar con mode:"discovery" para capturar screenshots
    //   3. Actualizar los selectores con los valores reales
    //
    // PATRÓN TÍPICO DE WU:
    //   - Dropdown/autocomplete para seleccionar país destino
    //   - Input numérico para monto a enviar
    //   - Resultados aparecen dinámicamente (React/SPA)
    //   - Múltiples "opciones de envío" con fees diferentes
    //

    // ── Paso 1: Seleccionar país destino ──
    // TODO: Identificar selector real del dropdown de país
    // Ejemplo: await page.click('#country-selector');
    //          await page.type('#country-search', country.name);
    //          await page.click(`[data-country="${country.code}"]`);

    // ── Paso 2: Ingresar monto ──
    // TODO: Identificar selector real del input de monto
    // Ejemplo: await page.click('#send-amount');
    //          await page.type('#send-amount', String(amount));

    // ── Paso 3: Esperar resultados ──
    // TODO: Identificar selector que indica que los resultados cargaron
    // Ejemplo: await waitForSelector(page, '.transfer-options-loaded');

    await humanDelay(3000, 5000);
    await captureScreenshot(page, `wu-results-${countryCode}-${amount}`);

    // ── Paso 4: Extraer datos del DOM ──
    const data = await page.evaluate(() => {
      // ════════════════════════════════════════════════════
      // ⚠️  EXTRACCIÓN DOM - REQUIERE SELECTORES REALES
      // ════════════════════════════════════════════════════
      //
      // Esta función se ejecuta DENTRO del browser.
      // Debe leer los elementos del DOM y extraer los datos.
      //
      // Patrón típico:
      //   - Buscar el contenedor de resultados
      //   - Iterar sobre cada "opción de envío"
      //   - Extraer: rate, fee, received amount, methods
      //
      // PLACEHOLDER - reemplazar con extracción real:
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
    await captureScreenshot(page, `wu-extract-error-${countryCode}`);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════
// MODO DISCOVERY
// ══════════════════════════════════════════════════════════

/**
 * Modo discovery: navega a las páginas clave y captura screenshots
 * anotados para identificar selectores.
 */
async function runDiscovery(page, email, password) {
  console.error('[WU] Running in DISCOVERY mode...');
  
  const screenshots = [];

  // 1. Página principal
  await page.goto(WU_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(3000, 5000);
  screenshots.push(await captureScreenshot(page, 'discovery-wu-home'));

  // 2. Intentar login
  const loggedIn = await login(page, email, password);
  screenshots.push(await captureScreenshot(page, 'discovery-wu-post-login'));

  // 3. Página de envío
  await page.goto(WU_SEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(3000, 5000);
  screenshots.push(await captureScreenshot(page, 'discovery-wu-send-page'));

  // 4. Capturar DOM tree (elementos interactivos)
  const domInfo = await page.evaluate(() => {
    const elements = [];
    // Inputs
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
    ({ browser, page } = await launchBrowser('wu'));

    // ── Modo Discovery ──
    if (args.mode === 'discovery') {
      const result = await runDiscovery(page, args.email, args.password);
      outputResult(result);
      return;
    }

    // ── Modo Normal: Scraping ──
    const { country, amount, email, password } = args;
    
    if (!country || !amount || !email || !password) {
      outputError('Missing required args: country, amount, email, password');
      return;
    }

    // Verificar sesión → login si necesario
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      const loginOk = await login(page, email, password);
      if (!loginOk) {
        outputError('Login failed', { country, amount });
        return;
      }
    }

    // Extraer datos
    const data = await extractRemittanceData(page, country, amount);

    // Formatear resultado
    const result = {
      timestamp: new Date().toISOString(),
      agent: 'Western Union',
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
    if (page) await captureScreenshot(page, 'wu-fatal-error');
    outputError(err.message, { country: args.country, amount: args.amount });
  } finally {
    if (browser) await browser.close();
  }
}

main();
