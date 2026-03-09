# ══════════════════════════════════════════════════════════
# n8n + Playwright + Chromium
# Para Railway (y compatible con cualquier Docker host)
# ══════════════════════════════════════════════════════════

FROM n8nio/n8n:latest

# Cambiar a root para instalar dependencias del sistema
USER root

# ── Dependencias de Chromium ──
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    npm \
    python3 \
    # Dependencias adicionales para Chromium estable
    font-noto-emoji \
    dbus \
    udev

# ── Variables de entorno para Playwright/Puppeteer ──
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

# ── Instalar dependencias Node para los scripts de scraping ──
WORKDIR /data/scripts
COPY scripts/package.json ./
RUN npm install --production

# ── Copiar scripts de scraping ──
COPY scripts/ ./

# ── Crear directorios para sesiones persistentes ──
RUN mkdir -p /data/sessions/wu /data/sessions/ria && \
    chown -R node:node /data/scripts /data/sessions

# ── Volver al usuario n8n (node) ──
USER node

# ── Puerto y comando por defecto (heredado de n8n) ──
EXPOSE 5678
