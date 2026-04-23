# WPO Analytics Engine — Manual de Arquitectura y Operación

**Versión:** 2.0 · **Audiencia:** Gerencia Operativa y Desarrolladores · **Fecha:** Abril 2026

---

## 1. Resumen Ejecutivo

### ¿Qué es este software?

El **WPO Analytics Engine** es una plataforma de monitorización de rendimiento web desarrollada internamente para auditar de forma continua y automatizada las páginas de **floressolidarias.org** (WordPress / WooCommerce).

A diferencia de herramientas externas de pago (GTmetrix, SpeedCurve), esta solución:

- **Corre en nuestra propia infraestructura**, sin coste por análisis ni dependencia de terceros.
- **Guarda el historial completo** de mediciones, permitiendo detectar cuándo y por qué una página empezó a rendir peor (p. ej., tras instalar un plugin nuevo).
- **Traduce datos técnicos a impacto de negocio**: un tiempo de carga elevado no es solo un número; se muestra como "Los clientes experimentan retrasos al añadir al carrito".

### Valor para el negocio

| Situación sin la herramienta | Situación con la herramienta |
|:---|:---|
| Detectamos caídas de rendimiento cuando los clientes se quejan | Detección automática antes de que afecte a ventas |
| No sabemos qué cambio en la web causó el problema | Trazabilidad histórica por fecha y URL |
| Contratar auditorías externas cada trimestre (coste recurrente) | Auditorías ilimitadas sin coste adicional |
| Análisis manuales, puntuales y sin comparativa histórica | Dashboard en tiempo real con tendencias de 7 días |

---

## 2. Arquitectura del Sistema

El sistema se compone de **4 servicios orquestados con Docker**. Todos arrancan con un único comando.

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                     │
│                                                             │
│  ┌──────────────┐    ┌─────────────────┐                   │
│  │   Frontend   │───▶│ api-orchestrator│                   │
│  │  React/Vite  │    │  Node.js :3000  │                   │
│  │    :5173     │    └────────┬────────┘                   │
│  └──────────────┘             │ encola trabajos             │
│                               ▼                             │
│                     ┌─────────────────┐                    │
│                     │   redis-queue   │                    │
│                     │   Redis :6379   │                    │
│                     └────────┬────────┘                   │
│                               │ consume trabajos            │
│                               ▼                             │
│                     ┌─────────────────┐                    │
│                     │lighthouse-worker│──▶ SQLite DB        │
│                     │ Puppeteer/Chrome│    /app/db/         │
│                     └─────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

| Servicio | Rol | Puerto |
|:---|:---|:---|
| `frontend` | Interfaz web (Dashboard, Reports, Site Explorer, Automations) | 5173 |
| `api-orchestrator` | API REST. Recibe peticiones y las encola en Redis | 3000 |
| `redis-queue` | Cola de mensajes en memoria. Coordina los análisis pendientes | 6379 |
| `lighthouse-worker` | Lanza Google Chrome de forma invisible, mide el rendimiento y guarda los resultados | — (interno) |

---

## 3. Guía Rápida de Despliegue

### Requisitos previos

- **Docker Desktop** instalado y en ejecución ([docker.com/get-docker](https://www.docker.com/get-docker))
- **Git** (para obtener el código)
- Conexión a Internet (primera vez, para descargar las imágenes base)

### Levantar todos los servicios

```bash
# 1. Obtener el código (solo la primera vez)
git clone https://github.com/tu-usuario/wpo-engine.git
cd wpo-engine

# 2. Arrancar todos los contenedores en segundo plano
docker compose up -d

# 3. Verificar que todos los servicios están activos
docker compose ps
```

**Resultado esperado** — todos los servicios deben mostrar estado `Up`:

```
NAME                  STATUS        PORTS
redis-queue           Up            0.0.0.0:6379->6379/tcp
api-orchestrator      Up            0.0.0.0:3000->3000/tcp
lighthouse-worker     Up
frontend              Up            0.0.0.0:5173->5173/tcp
```

### Acceder al panel

Abrir el navegador en: **`http://localhost:5173`**

### Apagar los servicios

```bash
# Apaga los contenedores (los datos se conservan)
docker compose down

# Apaga Y elimina todos los datos (¡destructivo!)
docker compose down -v
```

---

## 4. Mantenimiento — Base de Datos SQLite

### Ubicación exacta del archivo

La base de datos se almacena en un **volumen gestionado por Docker**, aislado del sistema de ficheros del host para mayor seguridad. El nombre del volumen es `wpo_db_data`.

Para localizar la ruta física exacta en tu máquina:

```bash
docker volume inspect wpo-engine_wpo_db_data
# Busca el campo "Mountpoint" en la salida:
# "Mountpoint": "/var/lib/docker/volumes/wpo-engine_wpo_db_data/_data"
```

El archivo se llama: `wpo-historics.sqlite`

### Copias de seguridad (Backup semanal recomendado)

**Opción A — Copia directa del archivo** (recomendada, sin detener el sistema):

```bash
# Crea una copia con fecha en el directorio actual
docker run --rm \
  -v wpo-engine_wpo_db_data:/data \
  -v $(pwd):/backup \
  alpine \
  cp /data/wpo-historics.sqlite /backup/wpo-backup-$(date +%Y%m%d).sqlite
```

**Opción B — Backup con SQLite dump** (texto plano, más portable):

```bash
# Genera un dump SQL legible
docker exec api-orchestrator \
  sh -c "sqlite3 /app/db/wpo-historics.sqlite .dump" \
  > wpo-backup-$(date +%Y%m%d).sql
```

> [!TIP]
> Programa una tarea semanal con el Programador de Tareas de Windows o un cron de Linux apuntando al comando de la Opción A. Guarda los backups en una carpeta sincronizada con Google Drive o similar.

### Restaurar un backup

```bash
# Detener primero los servicios que escriben en la DB
docker compose stop api-orchestrator lighthouse-worker

# Copiar el backup al volumen
docker run --rm \
  -v wpo-engine_wpo_db_data:/data \
  -v $(pwd):/backup \
  alpine \
  cp /backup/wpo-backup-YYYYMMDD.sqlite /data/wpo-historics.sqlite

# Reiniciar los servicios
docker compose start api-orchestrator lighthouse-worker
```

---

## 5. Troubleshooting — Guía de Resolución de Problemas

### 5.1 El Dashboard no carga / Pantalla en blanco

| Comprobación | Comando |
|:---|:---|
| ¿Están todos los contenedores activos? | `docker compose ps` |
| ¿Hay errores en la API? | `docker compose logs api-orchestrator --tail=50` |
| ¿El puerto 5173 está ocupado por otra app? | Cambiar el puerto en `docker-compose.yml` de `5173:5173` a `5174:5173` |

### 5.2 Los análisis se encolan pero nunca se completan

El síntoma es que el HUD muestra trabajos en cola indefinidamente.

```bash
# 1. Ver logs del Worker de Lighthouse
docker compose logs lighthouse-worker --tail=100 -f

# 2. Si aparece "Error launching Chrome" o "ENOMEM":
#    El servidor no tiene suficiente memoria RAM.
#    Reducir la concurrencia en worker/src/index.ts: concurrency: 1

# 3. Reiniciar solo el worker
docker compose restart lighthouse-worker
```

### 5.3 El sistema de alertas por email no envía notificaciones

Las alertas se procesan en el módulo `Automations`. Pasos de diagnóstico:

**Paso 1 — Verificar que la alerta está configurada correctamente:**
Acceder a la pestaña **Automations → Alertas** en el Dashboard. Confirmar que el email destino es correcto y que los umbrales tienen valores numéricos (no vacíos).

**Paso 2 — Revisar logs de la API:**
```bash
docker compose logs api-orchestrator --tail=100 | grep -i alert
```
Buscar líneas con `[Alert]` o `[ERROR]`. Si aparece `SMTP connection refused`, el servidor de correo no está configurado.

**Paso 3 — Variables de entorno SMTP (si se usa envío de email):**
Verificar que el fichero `.env` en la raíz del proyecto contiene:
```env
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASS=tu_contraseña
```
Reiniciar tras modificar: `docker compose restart api-orchestrator`

**Paso 4 — Purgar trabajos fallidos de la cola:**
Si la cola de Redis tiene trabajos bloqueados, limpiarla desde el Dashboard en **Automations → Estado de la Cola → Purgar Fallidos**, o via API:
```bash
curl -X POST http://localhost:3000/api/queue/clean-failed
```

### 5.4 La base de datos crece demasiado

La funcionalidad de limpieza automática (TTL de 30 días) está planificada en el Roadmap V2, Fase 2. Mientras tanto, purga manual:

```bash
# Eliminar registros de más de 30 días (ejecutar con los servicios activos)
docker exec api-orchestrator \
  sqlite3 /app/db/wpo-historics.sqlite \
  "DELETE FROM metrics WHERE timestamp < (strftime('%s','now','-30 days') * 1000);"
```

---

## 6. Contacto y Continuidad

| Recurso | Ubicación |
|:---|:---|
| Histórico de decisiones arquitectónicas | `docs/WPO_Version_Control_ADR.md` |
| Roadmap de funcionalidades futuras | `docs/WPO_Roadmap.md` |
| Arquitectura técnica del backend | `docs/WPO_Backend_Architecture.md` |
| Análisis de mercado y fundamentos | `docs/WPO_Analysis_Report.md` |

> [!NOTE]
> Este manual cubre el estado operativo de la versión **V2 SPA**. Para funcionalidades experimentales (Tauri Desktop, exportación PDF, Smart Sitemap Crawler), consultar el ADR y el Roadmap antes de implementar cambios.
