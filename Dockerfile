# ══════════════════════════════════════════════════════════
# n8n + Playwright + Chromium
# Para Railway (y compatible con cualquier Docker host)
# Base: n8n latest (Debian-based)
# ══════════════════════════════════════════════════════════

FROM n8nio/n8n:latest

# Cambiar a root para instalar dependencias del sistema
USER root

# ── Dependencias de Chromium (Debian/Ubuntu) ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    dbus \
    udev \
    && rm -rf /var/lib/apt/lists/*

# ── Variables de entorno para Puppeteer ──
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium

# ── Instalar dependencias Node para los scripts de scraping ──
WORKDIR /data/scripts
COPY scripts/package.json ./
RUN npm install --production

# ── Copiar scripts de scraping ──
COPY scripts/ ./

# ── Crear directorios para sesiones persistentes ──
RUN mkdir -p /data/sessions/wu /data/sessions/ria /data/sessions/screenshots && \
    chown -R node:node /data/scripts /data/sessions

# ── Volver al usuario n8n (node) ──
USER node

# ── Directorio de trabajo de n8n ──
WORKDIR /home/node

# ── Puerto y comando por defecto (heredado de n8n) ──
EXPOSE 5678
