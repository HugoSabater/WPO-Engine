FROM ghcr.io/puppeteer/puppeteer:22.0.0
WORKDIR /app

# Configurar para que la instalación NPM evite descargar un nuevo binario de Chrome,
# ya que la imagen docker ghcr.io/puppeteer/puppeteer ya lo incluye internamente.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copiar dependencias e instalar como root (para compilar sqlite3 nativo)
USER root
COPY package*.json ./
RUN npm install

# Copiar fuentes y compilar TypeScript
COPY --chown=pptruser:pptruser . .
RUN npm run build

# Volver a pptruser (que es quien debe ejecutar chromium/worker en runtime)
USER pptruser
CMD ["npm", "start"]
