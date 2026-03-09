# ══════════════════════════════════════════════════════════
# n8n + Puppeteer + Chromium
# Para Railway (y compatible con cualquier Docker host)
# Base: n8n v2.x (Alpine distroless — apk removido)
# Workaround: reinstalar apk-tools primero
# ══════════════════════════════════════════════════════════

FROM n8nio/n8n:latest

USER root

# ── Paso 1: Reinstalar apk (removido en n8n v2 distroless) ──
RUN ARCH=$(uname -m) && \
    wget -qO- "http://dl-cdn.alpinelinux.org/alpine/latest-stable/main/${ARCH}/" | \
    grep -o 'href="apk-tools-static-[^"]*\.apk"' | head -1 | cut -d'"' -f2 | \
    xargs -I {} wget -q "http://dl-cdn.alpinelinux.org/alpine/latest-stable/main/${ARCH}/{}" && \
    tar -xzf apk-tools-static-*.apk && \
    ./sbin/apk.static -X http://dl-cdn.alpinelinux.org/alpine/latest-stable/main \
        -U --allow-untrusted add apk-tools && \
    rm -rf sbin apk-tools-static-*.apk

# ── Paso 2: Instalar Chromium y dependencias ──
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# ── Variables de entorno para Puppeteer ──
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

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
