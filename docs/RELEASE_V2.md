# WPO Analytics Engine v2.0.0 — Notas de Lanzamiento

**Fecha de lanzamiento:** Mayo 2026
**Tipo:** Major release — Desktop Edition

---

## Descarga

Instala la última versión desde la pestaña [Releases de GitHub](https://github.com/HugoSabater/WPO-Engine/releases):

```
WPO Engine Setup 2.0.0.exe
```

**Requisito único:** Google Chrome instalado en Windows. No se necesita Node.js, Docker ni ninguna dependencia adicional.

---

## ¿Qué cambia respecto a la versión anterior?

La v2.0.0 elimina por completo la dependencia de Docker. La herramienta se distribuye como un instalador Windows estándar y funciona de manera autónoma.

| Aspecto | v1.x (Docker) | v2.0.0 (Desktop) |
|---------|--------------|-----------------|
| Instalación | Docker Desktop + `docker compose up` | Doble clic en el `.exe` |
| Base de datos | Volumen Docker compartido | Carpeta privada del usuario (`%APPDATA%`) |
| Motor de análisis | Puppeteer en contenedor Ubuntu | Chrome nativo del sistema |
| Cola de tareas | BullMQ + Redis (2 contenedores) | Cola en memoria (sin dependencias externas) |
| Scheduler | BullMQ repeatable jobs | `node-cron` integrado |

---

## Nuevas funcionalidades en v2.0.0

### Web Crawler integrado
Desde Site Explorer, activa el toggle **"Rastrear enlaces internos"** e introduce la URL raíz de tu tienda. El motor descargará el HTML, extraerá todos los enlaces internos y los enviará a auditar automáticamente en lote (hasta 50 URLs).

### Auditorías en lote
Envía hasta 50 URLs de una vez al motor de Lighthouse. Las auditorías se procesan de forma secuencial (una a la vez, para no saturar el PC) y los resultados aparecen en Reports cuando cada una termina.

### Filtros en Reports
La pestaña Reports incluye ahora un campo de búsqueda por URL y un selector de estado de salud (Todas / Críticas / Mejorables / Óptimas).

### Navegación contextual entre pestañas
- Desde **Reports** → crea una automatización para cualquier URL con un clic en el icono de reloj.
- Desde **Site Explorer** → abre el detalle completo de cualquier URL en Dashboard, o filtra los resultados en Reports.

---

## Privacidad de datos

Cada instalación crea una base de datos SQLite completamente aislada:

```
C:\Users\<usuario>\AppData\Roaming\WPO Analytics Engine\wpo-historics.sqlite
```

Esta ruta:
- Es exclusiva de cada perfil de Windows.
- No se incluye en el repositorio de código (protegida por `.gitignore`).
- No se transmite a ningún servidor externo.
- Al instalar la app en otro PC, se crea una base de datos nueva y vacía.

---

## Compartir la herramienta

Para distribuir la herramienta a compañeros de equipo:

1. Descarga el instalador desde [Releases](https://github.com/HugoSabater/WPO-Engine/releases).
2. Envía el archivo `WPO Engine Setup 2.0.0.exe` por cualquier medio (Drive, WeTransfer, Slack).
3. Cada persona lo instala en su PC con doble clic.

No se comparten datos entre instalaciones.

---

## Historial completo de cambios

Ver [`CHANGELOG.md`](./CHANGELOG.md) para el registro detallado de todos los cambios de esta versión y las anteriores.
