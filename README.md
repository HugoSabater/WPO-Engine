# WPO Analytics Engine: Plataforma de Rendimiento y Monitorización

> **WPO Analytics Engine** es una plataforma de alto rendimiento para la monitorización y auditoría de Web Performance Optimization. Diseñada para arquitecturas complejas (WordPress/WooCommerce), permite la ejecución asíncrona de auditorías Lighthouse, trazabilidad histórica de métricas y análisis de impacto en negocio, todo orquestado mediante microservicios Docker (Node.js, BullMQ, Redis y Puppeteer).

## 1. Propósito del Software

El **WPO Analytics Engine** es una plataforma integral diseñada para resolver el problema de la ceguera histórica y técnica en optimización web (WPO), especialmente en arquitecturas pesadas como WordPress, WooCommerce y Elementor.

Las herramientas tradicionales de navegador proporcionan un rendimiento estático sujeto a fluctuaciones de hardware y red, arrojando métricas aisladas. Este motor resuelve esa deficiencia mediante:

1.  **Monitorización Autónoma y Bajo Demanda:** Permite encolar auditorías asíncronas sobre diferentes URLs sin bloquear la interfaz de usuario, además de mantener cron jobs.
2.  **Capa de Traducción (Business Impact):** Ingiere datos estrictamente técnicos (ej. `Total Blocking Time` alto) y los traduce dinámicamente al impacto real de conversión de negocio (ej. _"Los clientes experimentan bloqueos al añadir al carrito"_).
3.  **Trazabilidad Histórica:** Fija auditorías como _"Baselines"_ (Métricas Base) para detectar regresiones tras instalar nuevos plugins o modificar el código.

## 2. Características Principales (Features)

- 📱 **Soporte Multi-Dispositivo (Desktop / Mobile):** Selector integrado para ejecutar análisis bajo parámetros exactos de emulación de CPU, viewport y densidad de píxeles móviles o de escritorio.
- 📸 **Vista Previa Visual (Device Mockups):** El motor Chromium captura el renderizado final (Base64) en el momento del escaneo y la interfaz lo proyecta adaptando el marco físico (Vertical/Horizontal) de forma fluida.
- 🗂️ **Smart Clustering (Agrupación Inteligente):** Agrupa automáticamente las métricas de URLs por sus subdirectorios (`/blog/`, `/categoria/`, etc.) para identificar cuellos de botella específicos de la arquitectura de la web.
- ♻️ **Controles In-Place:** Botones integrados para re-escanear URLs conservando su estrategia original o destruir registros (Clean-up), todo con un sistema interactivo de loading en vivo.
- 📈 **Gráficas de Tendencia:** Evolución de los últimos 7 días con un algoritmo unificado (`Performance Score`) para visualización C-Level.

## 3. Arquitectura e Infraestructura (Docker)

El ecosistema opera mediante una orquestación basada en microservicios, optimizada para ejecutarse en entornos humildes (VPS, Droplets de 2GB) sin fugas de memoria.

| Contenedor          | Rol Arquitectónico                   | Core Tech Stack                               |
| :------------------ | :----------------------------------- | :-------------------------------------------- |
| `frontend`          | UI Contextual de React               | React, Vite, Tailwind CSS (Dark-Charcoal)     |
| `api-orchestrator`  | API REST & Cola de Tareas (Producer) | Node.js, Express (CORS/GZIP), BullMQ, SQLite  |
| `lighthouse-worker` | Consumidor asíncrono y Render        | Ubuntu, Puppeteer Headless, Google Lighthouse |
| `redis-queue`       | Message Broker en Memoria RAM        | Redis 7 Alpine                                |

## 4. Diseño Técnico y Optimizaciones Avanzadas

### 4.1 Patrón Productor-Consumidor (BullMQ)

El análisis DOM de Lighthouse (emulando red 4G y throttling de CPU) asfixia y bloquea servidores web. La arquitectura implementa un orquestador que **encola URIs en Redis (Producer)** y libera la solicitud devolviendo un `202 Accepted`. El **Worker aislado (Consumer)** atrapa la tarea, lanza Google Chrome (Puppeteer), genera la telemetría y escribe en disco.

### 4.2 Optimización Extrema del Worker (Puppeteer)

Levantar instancias de Chromium es devastador para la memoria RAM. El worker está blindado con:

- Bloqueo de concurrencia a nivel de configuración.
- Flags en tiempo de ejecución: `--disable-dev-shm-usage`, `--disable-gpu`, `--single-process`, `--no-zygote`. Previniendo los temidos cuelgues `Aw, Snap!` y fugas masivas de hilos (Zombie Processes).
- La imagen Docker evita descargar y compilar binarios pesados iterativamente, utilizando una imagen maestra con Chrome pre-empacado y controlada mediante variables de entorno `PUPPETEER_SKIP_DOWNLOAD`.

### 4.3 Persistencia y Compresión GZIP

- **SQLite en Modo WAL:** Habilita el `Write-Ahead Logging`, lo que previene por diseño el bloqueo colisional transaccional (`SQLITE_BUSY`). La DB permite al React Frontend leer cientos de historiales y gráficas concurrentemente mientras el Worker escribe auditorías completas.
- **Payload Network Optimization:** La API integra Middleware Compression (GZIP/Deflate) y ajusta los límites de red de Express para devolver eficientemente las capturas Base64 generadas, recortando pesos de payload de ~18MB a ~1MB, asegurando un TTFB relámpago en el Dashboard.

### 4.4 Arquitectura Frontend React

- Peticiones eficientes consolidadas vía `Promise.all` para hidratar la UI de golpe sin _Waterfalls_.
- `useMemo` avanzado para la clasificación polinómica de Clústeres de sub-carpetas de URL.
- Component-Driven con Tailwind CSS en un UI fuertemente estandarizado y responsivo.
