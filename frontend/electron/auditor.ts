/**
 * auditor.ts — Motor de auditorías Lighthouse para modo Electron standalone.
 *
 * Diferencias respecto al worker Docker original:
 *  - No usa BullMQ ni Redis: cola interna en memoria (array + semáforo).
 *  - No usa Puppeteer: usa chrome-launcher directamente (más ligero en desktop).
 *  - Concurrencia máxima: 1 (evitar saturar CPU/RAM en el PC del usuario).
 *  - La DB se escribe vía la misma instancia compartida del proceso principal.
 */

import * as chromeLauncher from 'chrome-launcher';
import lighthouse      from 'lighthouse';
import path            from 'node:path';
import sqlite3         from 'sqlite3';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface AuditJob {
  url:      string;
  strategy: 'mobile' | 'desktop';
  resolve?: (metrics: AuditMetrics) => void;
  reject?:  (err: Error) => void;
}

export interface AuditMetrics {
  url:               string;
  timestamp:         number;
  ttfb:              number;
  lcp:               number;
  cls:               number;
  tbt:               number;
  domSize:           number;
  strategy:          string;
  screenshot_base64: null;
}

// ─── Semáforo de concurrencia (máx 1 auditoría simultánea en desktop) ─────────
let isRunning = false;
const queue: AuditJob[] = [];

// ─── Base de datos (misma ruta inyectada por main.ts via WPO_DB_PATH) ─────────
function getDb(): sqlite3.Database {
  const dbPath = process.env.WPO_DB_PATH
    ?? path.join(process.env.APPDATA ?? process.env.HOME ?? '.', 'wpo-historics.sqlite');
  return new sqlite3.Database(dbPath);
}

function insertMetric(metrics: AuditMetrics): Promise<void> {
  return new Promise((resolve, reject) => {
    const db   = getDb();
    const stmt = db.prepare(
      'INSERT INTO metrics (url, timestamp, ttfb, lcp, cls, tbt, domSize, strategy, screenshot_base64) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      metrics.url, metrics.timestamp, metrics.ttfb, metrics.lcp,
      metrics.cls, metrics.tbt, metrics.domSize, metrics.strategy, null,
      (err: Error | null) => {
        stmt.finalize();
        db.close();
        if (err) reject(err);
        else     resolve();
      }
    );
  });
}

// ─── Motor Lighthouse ─────────────────────────────────────────────────────────
async function runAudit(job: AuditJob): Promise<AuditMetrics> {
  const { url, strategy } = job;
  console.log(`[Auditor] Iniciando → ${url} (${strategy})`);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const lhOptions = {
      logLevel:        'error'  as const,
      output:          'json'   as const,
      onlyCategories:  ['performance'],
      port:            chrome.port,
      formFactor:      strategy as 'mobile' | 'desktop',
      screenEmulation: {
        mobile:            strategy === 'mobile',
        width:             strategy === 'mobile' ? 412   : 1350,
        height:            strategy === 'mobile' ? 823   : 940,
        deviceScaleFactor: strategy === 'mobile' ? 1.75  : 1,
        disabled:          false,
      },
    };

    const result = await lighthouse(url, lhOptions);
    if (!result) throw new Error('Lighthouse returned undefined');

    const audits = result.lhr.audits;
    const metrics: AuditMetrics = {
      url,
      timestamp:         Date.now(),
      ttfb:              audits['server-response-time']?.numericValue       ?? 0,
      lcp:               audits['largest-contentful-paint']?.numericValue   ?? 0,
      cls:               audits['cumulative-layout-shift']?.numericValue    ?? 0,
      tbt:               audits['total-blocking-time']?.numericValue        ?? 0,
      domSize:           audits['dom-size']?.numericValue                   ?? 0,
      strategy,
      screenshot_base64: null,
    };

    await insertMetric(metrics);
    console.log(`[Auditor] ✓ Completado → ${url}`);
    return metrics;

  } finally {
    await chrome.kill();
  }
}

// ─── Procesador de cola interna ───────────────────────────────────────────────
async function processNext(): Promise<void> {
  if (isRunning || queue.length === 0) return;
  isRunning = true;

  const job = queue.shift()!;
  try {
    const metrics = await runAudit(job);
    job.resolve?.(metrics);
  } catch (err) {
    console.error(`[Auditor] Error en ${job.url}:`, err);
    job.reject?.(err as Error);
  } finally {
    isRunning = false;
    // Procesar el siguiente en la cola (si hay)
    setImmediate(processNext);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────
/**
 * Encola una auditoría y devuelve una Promise que resuelve cuando termina.
 * Si la cola ya está procesando, el job espera su turno.
 */
export function enqueueAudit(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<AuditMetrics> {
  return new Promise((resolve, reject) => {
    queue.push({ url, strategy, resolve, reject });
    processNext();
  });
}

/** Número de auditorías pendientes en cola (para el HUD del frontend). */
export function getQueueLength(): number {
  return queue.length + (isRunning ? 1 : 0);
}
