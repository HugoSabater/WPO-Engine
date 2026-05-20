# WPO Analytics Engine

> Herramienta de escritorio para monitorización continua del rendimiento web. Audita URLs con Google Lighthouse, almacena el histórico localmente y genera alertas cuando las métricas de Core Web Vitals se degradan.

[![Versión](https://img.shields.io/badge/versión-2.0.0-blue)](./docs/CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](./LICENSE)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows-lightgrey)](./docs/RELEASE_V2.md)

---

## ¿Qué hace esta herramienta?

El WPO Analytics Engine resuelve tres problemas concretos en entornos WordPress/WooCommerce:

1. **Ceguera histórica** — Las herramientas de navegador dan un snapshot puntual. Este motor guarda cada auditoría en una base de datos local y permite comparar evolución temporal.
2. **Falta de automatización** — Programa auditorías periódicas con expresiones cron sin depender de servicios externos.
3. **Brecha técnica-negocio** — Traduce métricas técnicas (LCP, TBT, CLS) a impacto de conversión comprensible para equipos de marketing.

---

## Instalación rápida

Descarga el instalador desde la pestaña [Releases](https://github.com/HugoSabater/WPO-Engine/releases) de este repositorio.

**Requisito único:** tener [Google Chrome](https://www.google.com/chrome/) instalado en el sistema.

No es necesario instalar Node.js, Docker ni ninguna dependencia adicional. El instalador incluye todo lo necesario.

---

## Capturas de pantalla

| Dashboard | Site Explorer | Automations |
|-----------|--------------|-------------|
| Estado de salud global, gráfica de 7 días e insights de negocio | Rastreo de URLs internas y auditorías en lote | Programación de auditorías periódicas por cron |

---

## Arquitectura (resumen)

El ejecutable contiene un servidor Express embebido que arranca en `127.0.0.1:3000` al abrir la app. La interfaz React se comunica con él vía HTTP local. No hay conexión a internet requerida salvo para cargar las páginas que se auditan.

```
Electron Shell
├── Express Server (:3000)  ←→  SQLite (%APPDATA%\wpo-engine\)
│   ├── WPOController       — auditorías y métricas
│   ├── AutomationsController — cron jobs y alertas
│   └── CrawlerController   — rastreo de enlaces internos
└── React SPA (Vite)        ←→  Express Server
```

Para la documentación técnica completa ver [`docs/technical/architecture.md`](./docs/technical/architecture.md).

---

## Documentación

### Para usuarios y equipos de negocio

| Documento | Descripción |
|-----------|-------------|
| [Guía de colores](./docs/manual-colores.md) | Qué hacer cuando aparece un indicador rojo o naranja. Sin tecnicismos. |
| [Notas de lanzamiento v2.0.0](./docs/RELEASE_V2.md) | Novedades de la versión Desktop Edition. |

### Para desarrolladores

| Documento | Descripción |
|-----------|-------------|
| [Arquitectura global](./docs/technical/architecture.md) | Flujo de datos, endpoints, configuración de build. |
| [Dashboard — técnico](./docs/technical/dashboard.md) | Fuentes de datos, scoring, modos de vista, polling. |
| [Automations — técnico](./docs/technical/automations.md) | API de cron jobs y alertas, parámetros exactos. |
| [Herramientas internas](./docs/technical/internal-tools.md) | Auditor, crawler, base de datos, scripts de build. |
| [Changelog](./docs/CHANGELOG.md) | Historial de versiones y decisiones de arquitectura. |
| [Análisis de mercado WPO](./docs/WPO_Analysis_Report.md) | Comparativa técnica vs GTmetrix, LHCI, WebPageTest y SpeedCurve. |

---

## Desarrollo local

```bash
# Instalar dependencias
cd frontend && npm install

# Modo desarrollo (con hot-reload, proxy a localhost:3000)
npm run dev

# Compilar instalador Windows
npm run make:win
```

El instalador se genera en `C:\WPO-Build\release\`.

---

## Privacidad de datos

Cada instalación crea una base de datos SQLite aislada en el perfil del usuario (`%APPDATA%\WPO Analytics Engine\wpo-historics.sqlite`). Esta ruta no se versiona, no se comparte en red y no está incluida en el repositorio. Ver [`.gitignore`](./.gitignore).

---

## Licencia

[MIT](./LICENSE) — Hugo S., 2026.
