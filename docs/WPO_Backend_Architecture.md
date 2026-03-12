# Arquitectura Asíncrona WPO: Motor de Auditoría

_Motor Backend Node.js para Ecosistemas WordPress (Max 2 Concurrencia)_

Tomando en cuenta las directrices del Arquitecto ("Alertas de Senior"), propongo el siguiente diseño robusto y escalable para evitar el colapso del servidor de producción, esquivar el infierno de dependencias de Puppeteer en Linux y garantizar el almacenamiento histórico seguro.

---

## 1. Topología del Ecosistema Docker (docker-compose)

El sistema se orquesta en 3 contenedores independientes para separar la API de consumo, el gestor de colas y el consumidor pesado de CPU (Lighthouse).

- **`redis-queue`**: Base de datos en memoria (Redis) necesaria para gestionar los _Jobs_ de BullMQ.
- **`api-orchestrator`**: API REST en Node.js que recibe el array de URLs (hasta 50) e inserta los trabajos en Redis. Conectará a SQLite para las lecturas.
- **`lighthouse-worker`**: Consumidor aislado que ejecuta Headless Chrome programáticamente. Utiliza imagen oficial `ghcr.io/puppeteer/puppeteer` para asegurar que `libnss3` y librerías de renderizado X11/Wayland estén integradas, mitigando crashes fatales.

### Estructura de Directorios

```text
c:.../tools/wpo-engine/
├── docker-compose.yml              # Orquestador del Ecosistema
├── api/                            # Orquestador (Node/Express)
│   └── src/
│       ├── controllers/            # wpo.controller.ts
│       ├── services/               # queue.service.ts
│       └── models/                 # database.ts (SQLite Wrapper)
├── worker/                         # Runner (Puppeteer Service)
│   └── src/
│       └── jobs/                   # lighthouse.processor.ts
├── frontend/                       # Dashboard (React/Vite)
└── docs/                           # Reportes y Arquitectura
```

---

## 2. Código Core: Orquestador y Worker de Lighthouse

A continuación expongo la lógica esencial con el tipado estricto requerido.

### A) Controlador Principal (`wpo.controller.ts`)

- **Misión:** Recibir la petición POST, validar el límite (50) y delegar a la cola.

```typescript
import { Request, Response } from "express";
import { QueueService } from "../services/queue.service";

export class WPOController {
  /**
   * Endpoint: POST /api/audit/batch
   * Payload: { urls: string[] }
   */
  public static async enqueueBatchAudit(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { urls } = req.body;

      // Validación Defensiva (Límites)
      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ error: "Payload requires an array of URLs." });
        return;
      }

      if (urls.length > 50) {
        res.status(413).json({
          error: "Payload exceeds the maximum allowed length of 50 URLs.",
        });
        return;
      }

      // Inserción asíncrona en BullMQ
      const jobIds = await QueueService.addBatch(urls);

      res.status(202).json({
        message: `Accepted ${urls.length} URLs for WPO analysis.`,
        queued_jobs: jobIds,
      });
    } catch (error) {
      console.error("[WPOController] Error enqueueing batch:", error);
      res
        .status(500)
        .json({ error: "Internal Server Error processing queue." });
    }
  }
}
```

### B) Gestor de la Cola (Productor) (`queue.service.ts`)

```typescript
import { Queue } from "bullmq";

// Conexión Redis mapeada internamente por Docker Compose
const connection = {
  host: process.env.REDIS_HOST || "redis-queue",
  port: 6379,
};

const lighthouseQueue = new Queue("LighthouseAudit", { connection });

export class QueueService {
  public static async addBatch(urls: string[]): Promise<string[]> {
    const jobs = urls.map((url) => ({
      name: "audit-url",
      data: { url, timestamp: Date.now() },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 2000 } }, // Retry Logic
    }));

    const addedJobs = await lighthouseQueue.addBulk(jobs);
    return addedJobs.map((job) => job.id as string);
  }
}
```

### C) El Worker de Lighthouse programático (`lighthouse.processor.ts`)

- **Misión:** Consumir de Redis con **concurrencia estricta de 2**, correr Lighthouse local e inyectar el resultado al SQLite.

```typescript
import { Worker, Job } from "bullmq";
import lighthouse from "lighthouse";
import puppeteer from "puppeteer";
import { Database } from "../models/database"; // SQLite Abstraction

const connection = {
  host: process.env.REDIS_HOST || "redis-queue",
  port: 6379,
};

// Concurrencia estricta bloqueada en 2 para no saturar CPU (GAP de recursos mitigado)
export const wpoWorker = new Worker(
  "LighthouseAudit",
  async (job: Job) => {
    const { url, timestamp } = job.data;
    console.log(`[Worker] Iniciando análisis para: ${url}`);

    // Lanzar puppeteer apuntando a su bind local (ghcr.io/puppeteer default)
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Seteado a /usr/bin/google-chrome-stable en Docker
    });

    try {
      const port = new URL(browser.wsEndpoint()).port;

      // Ejecutar LH de forma programática
      const lhOptions = {
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance"],
        port: Number(port),
      };

      const runnerResult = await lighthouse(url, lhOptions);
      const audits = runnerResult.lhr.audits;

      // Extraer métricas vitales
      const metrics = {
        url: url,
        timestamp: timestamp,
        ttfb: audits["server-response-time"].numericValue,
        lcp: audits["largest-contentful-paint"].numericValue,
        cls: audits["cumulative-layout-shift"].numericValue,
        tbt: audits["total-blocking-time"].numericValue,
        domSize: audits["dom-size"].numericValue,
      };

      // Guardado local a SQLite (Persistencia Histórica)
      await Database.insertMetric(metrics);

      console.log(`[Worker] Análisis completado con éxito para: ${url}`);
      return metrics;
    } catch (error) {
      console.error(`[Worker] Falla crítica al analizar ${url}:`, error);
      throw error;
    } finally {
      await browser.close();
    }
  },
  {
    connection,
    concurrency: 2, // <-- EL CORE DEFENSIVO: Max 2 análisis simultáneos.
  },
);
```

---

> [!CAUTION]
> **Bloqueos a prever:** Al leer y escribir en el archivo SQLite desde dos contenedores distintos (el _api-orchestrator_ para lectura del panel, y el _lighthouse-worker_ para la inserción concurrente), deberemos asegurarnos fuertemente de activar el **modo WAL (Write-Ahead Logging)** en SQLite al momento de instanciar la BD, y mapear el volumen apropiadamente a nivel de SO anfitrión para evitar corrupciones de `SQLITE_BUSY`.
