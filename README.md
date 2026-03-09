# n8n + Playwright — Scraping de Remesas

Sistema automatizado para recolectar datos de precios de remesas desde Chile.

## Servicios soportados
- **Afex** — API directa (ya implementado en n8n)
- **Western Union** — Browser automation (Puppeteer + Stealth)
- **RIA** — Browser automation (Puppeteer + Stealth)

## Estructura del proyecto

```
n8n-remesas/
├── Dockerfile          # n8n + Chromium + Puppeteer
├── railway.toml        # Config de Railway
├── scripts/
│   ├── package.json    # Dependencias de los scrapers
│   ├── browser-utils.js    # Utilidades compartidas
│   ├── scraper-wu.js       # Scraper Western Union
│   ├── scraper-ria.js      # Scraper RIA
│   └── test-browser.js     # Test de verificación
└── sessions/           # Sesiones persistentes (gitignored)
```

## Deploy en Railway

### Paso 1: Crear repositorio en GitHub
```bash
git init
git add .
git commit -m "Initial: n8n + Playwright setup"
git remote add origin https://github.com/TU_USUARIO/n8n-remesas.git
git push -u origin main
```

### Paso 2: Conectar a Railway
1. En Railway dashboard, ir al proyecto de n8n
2. Click en el servicio de n8n → Settings → Source
3. Cambiar de "Template" a "GitHub Repo"
4. Seleccionar el repo `n8n-remesas`
5. Railway detectará el Dockerfile automáticamente

### Paso 3: Configurar variables de entorno
En Railway → Variables, agregar:
```
# n8n (si no las tienes ya)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=tu_usuario
N8N_BASIC_AUTH_PASSWORD=tu_password

# Scrapers
SCRAPER_AMOUNTS=[50000,100000,300000,500000]
SCRAPER_COUNTRIES=["VE","PE","HT","CO","BR","AR"]
WU_EMAIL=tu_email_wu
WU_PASSWORD=tu_password_wu
RIA_EMAIL=tu_email_ria
RIA_PASSWORD=tu_password_ria
```

### Paso 4: Verificar que Chromium funciona
Desde n8n, crear un workflow temporal con un nodo **Execute Command**:
```
node /data/scripts/test-browser.js
```
Debe retornar: `{"status":"ok","chromium":"working",...}`

### Paso 5: Ejecutar Discovery
Antes de usar los scrapers, ejecutar en modo discovery para capturar
screenshots y mapear los selectores reales de cada sitio:
```
node /data/scripts/scraper-wu.js '{"mode":"discovery","email":"TU_EMAIL","password":"TU_PASS"}'
node /data/scripts/scraper-ria.js '{"mode":"discovery","email":"TU_EMAIL","password":"TU_PASS"}'
```
Los screenshots se guardan en `/data/sessions/screenshots/`.

## Uso desde n8n

### Execute Command node
```
node /data/scripts/scraper-wu.js '{"country":"VE","amount":100000,"email":"{{$env.WU_EMAIL}}","password":"{{$env.WU_PASSWORD}}"}'
```

### Parsear resultado (Code node)
```javascript
const output = $input.first().json.stdout;
const data = JSON.parse(output);
return [{ json: data }];
```

## Notas importantes

- Los scripts usan `stdout` para datos y `stderr` para logs/debug
- Las sesiones persistentes se guardan en `/data/sessions/`
- Screenshots de debug van a `/data/sessions/screenshots/`
- Los selectores en los scrapers son **PLACEHOLDERS** — deben actualizarse
  con los selectores reales después de ejecutar el modo discovery
