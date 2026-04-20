/**
 * AutomationsService
 * CRUD tipado para las tablas `cronjobs` y `alerts` de SQLite.
 * La instancia de DB se importa desde el módulo centralizado de Database
 * para compartir la misma conexión WAL y evitar bloqueos de escritura.
 */
import sqlite3 from 'sqlite3';
import { resolve } from 'path';

// ─── Tipos exportados (compartidos con el controlador) ────────────────────────
export type Strategy    = 'mobile' | 'desktop';
export type AlertDevice = 'mobile' | 'desktop' | 'both';
export type AlertMetric = 'score' | 'lcp' | 'ttfb' | 'cls' | 'tbt';
export type MetricThresholds = Partial<Record<AlertMetric, number>>;

export interface CronJobRow {
    id:              number;
    url:             string;
    strategy:        Strategy;
    cron_expression: string;
    active:          boolean;
    created_at:      string;
}

export interface AlertRow {
    id:         number;
    email:      string;
    device:     AlertDevice;
    thresholds: MetricThresholds; // deserializado desde JSON
    created_at: string;
}

// Payload de creación (sin id/created_at, los genera SQLite)
export interface CreateCronJobDto {
    url:             string;
    strategy:        Strategy;
    cron_expression: string;
}

export interface CreateAlertDto {
    email:      string;
    device:     AlertDevice;
    thresholds: MetricThresholds;
}

// ─── Conexión compartida ──────────────────────────────────────────────────────
// Usamos la misma ruta que database.ts para trabajar sobre el mismo archivo SQLite.
const dbPath = process.env.NODE_ENV === 'development'
    ? resolve(__dirname, '../../wpo-historics.sqlite')
    : '/app/db/wpo-historics.sqlite';

const db = new sqlite3.Database(dbPath);

// Helper interno: envuelve db.run en Promise y captura `this.lastID`
function runInsert(sql: string, params: unknown[]): Promise<number> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Helper interno: envuelve db.run en Promise genérico (UPDATE / DELETE)
function runMutate(sql: string, params: unknown[]): Promise<number> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Helper interno: envuelve db.all en Promise
function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
        });
    });
}

// ─── CronJob CRUD ─────────────────────────────────────────────────────────────
export class AutomationsService {

    // ── Cronjobs ──────────────────────────────────────────────────────────────

    public static async getCronjobs(): Promise<CronJobRow[]> {
        const rows = await queryAll<any>(
            'SELECT * FROM cronjobs ORDER BY created_at DESC'
        );
        // SQLite guarda BOOLEAN como 0/1; lo normalizamos a boolean.
        return rows.map(r => ({ ...r, active: r.active === 1 }));
    }

    public static async addCronjob(dto: CreateCronJobDto): Promise<CronJobRow> {
        const id = await runInsert(
            'INSERT INTO cronjobs (url, strategy, cron_expression, active) VALUES (?, ?, ?, 1)',
            [dto.url, dto.strategy, dto.cron_expression]
        );
        const [row] = await queryAll<any>('SELECT * FROM cronjobs WHERE id = ?', [id]);
        return { ...row, active: row.active === 1 };
    }

    public static async toggleCronjob(id: number, active: boolean): Promise<void> {
        const changes = await runMutate(
            'UPDATE cronjobs SET active = ? WHERE id = ?',
            [active ? 1 : 0, id]
        );
        if (changes === 0) throw new Error('Cronjob not found');
    }

    public static async deleteCronjob(id: number): Promise<void> {
        const changes = await runMutate('DELETE FROM cronjobs WHERE id = ?', [id]);
        if (changes === 0) throw new Error('Cronjob not found');
    }

    // ── Alerts ────────────────────────────────────────────────────────────────

    public static async getAlerts(): Promise<AlertRow[]> {
        const rows = await queryAll<any>('SELECT * FROM alerts ORDER BY created_at DESC');
        return rows.map(r => ({
            ...r,
            // `thresholds` se almacena como JSON string; lo parseamos al leer.
            thresholds: JSON.parse(r.thresholds ?? '{}') as MetricThresholds,
        }));
    }

    public static async addAlert(dto: CreateAlertDto): Promise<AlertRow> {
        const thresholdsJson = JSON.stringify(dto.thresholds);
        const id = await runInsert(
            'INSERT INTO alerts (email, device, thresholds) VALUES (?, ?, ?)',
            [dto.email, dto.device, thresholdsJson]
        );
        const [row] = await queryAll<any>('SELECT * FROM alerts WHERE id = ?', [id]);
        return { ...row, thresholds: JSON.parse(row.thresholds) };
    }

    public static async deleteAlert(id: number): Promise<void> {
        const changes = await runMutate('DELETE FROM alerts WHERE id = ?', [id]);
        if (changes === 0) throw new Error('Alert not found');
    }
}
