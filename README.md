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
- 📸 **Vista Previa Visual (Device Mockups):** El motor Chromium captura el renderizado final (JPG en Storage Local) en el momento del escaneo, mitigando drásticamente sobrecargas de hardware y la interfaz lo proyecta nativamente adaptando el marco físico de forma fluida.
- 🗂️ **Smart Clustering (Agrupación Inteligente):** Agrupa automáticamente las métricas de URLs por sus subdirectorios (`/blog/`, `/categoria/`, etc.) para identificar cuellos de botella específicos de la arquitectura de la web.
- ♻️ **Controles In-Place:** Botones integrados para re-escanear URLs conservando su estrategia original o destruir registros (Clean-up), todo con un sistema interactivo de loading en vivo.
- 📈 **Gráficas de Tendencia:** Evolución de los últimos 7 días con un algoritmo unificado (`Performance Score`) para visualización C-Level.

## 3. Arquitectura e Infraestructura (Desktop)

El ecosistema opera como una **Aplicación Nativa de Escritorio** empaquetada con Electron, optimizada para ejecutarse localmente sin configuraciones de red o dependencias externas.

| Componente          | Rol Arquitectónico                   | Core Tech Stack                               |
| :------------------ | :----------------------------------- | :-------------------------------------------- |
| **Electron Main**   | Orquestador y Servidor Local         | Node.js, Express (CORS/GZIP), SQLite, Cron    |
| **Electron UI**     | Interfaz de Usuario SPA              | React, Vite, Tailwind CSS (Dark-Charcoal)     |
| **Motor de Análisis**| Ejecución de Auditorías              | `chrome-launcher`, Google Lighthouse          |
| **Web Crawler**     | Rastreo en lote (Batch Audit)        | `cheerio`, `node-fetch`                       |

## 📚 Documentación Oficial y Arquitectura

Para entender la evolución y arquitectura de esta herramienta, consulta la siguiente documentación actualizada:

- **[Notas de Lanzamiento V2.0.0 (Desktop Edition)](./docs/RELEASE_V2.md)**: El manual de distribución, arquitectura actual e instrucciones de despliegue para compartir el `.exe`.
- **[Histórico de Versiones y Decisiones (ADR)](./docs/WPO_Version_Control_ADR.md)**: Documento retrospectivo para entender el "antes vs ahora" (Migración de Docker a Electron, SPA).
- **[Reporte Analítico WPO](./docs/WPO_Analysis_Report.md)**: Fundamentos teóricos sobre la variabilidad de red en Lighthouse y la estrategia de mitigación.

*(Nota: Los archivos antiguos de hojas de ruta de Sprints o manuales de Docker han quedado obsoletos y han sido purgados de este repositorio para mantener la pureza de la rama).*

---

## 4. Diseño Técnico y Optimizaciones Avanzadas

### 4.1 Aislamiento de Base de Datos (Seguridad de Datos)

El motor SQLite ya no se distribuye dentro del código ni requiere de persistencia en contenedores. El archivo de base de datos se despliega automáticamente en la carpeta `%APPDATA%` (Windows) del perfil del usuario, garantizando privacidad absoluta de los reportes.

### 4.2 Optimización de Chromium y Lighthouse

Levantar instancias de Chromium es devastador para la memoria RAM. El auditor está blindado utilizando `chrome-launcher`, que detecta automáticamente tu versión nativa de Google Chrome instalada en tu sistema. Esto evita descargar pesados binarios portátiles y elimina riesgos de `Out Of Memory` al usar el SO directamente.

### 4.3 Crawler Nativo Integrado

Hemos superado las limitaciones de lanzar URL por URL implementando un endpoint embebido con `cheerio` que navega el DOM y auto-descubre URLs internas en masa. Combinado con un encolador asíncrono y los Crons Nativos de Node.js, las auditorías fluyen solas sin bloquear la interfaz.
