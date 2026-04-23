import sqlite3 from 'sqlite3';
import { resolve } from 'path';

// En producción Docker el volumen está en /app/db
const dbPath = process.env.NODE_ENV === 'development' 
    ? resolve(__dirname, '../../wpo-historics.sqlite') 
    : '/app/db/wpo-historics.sqlite';

const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Modo WAL crítico para concurrencia API vs Worker
        db.run('PRAGMA journal_mode = WAL;');
        db.run(`
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                timestamp INTEGER,
                ttfb REAL,
                lcp REAL,
                cls REAL,
                tbt REAL,
                domSize INTEGER,
                is_baseline INTEGER DEFAULT 0,
                strategy TEXT DEFAULT 'mobile',
                screenshot_base64 TEXT
            )
        `);
        // Intentar añadir las columnas a bases de datos existentes (ignora error si ya existen)
        db.run("ALTER TABLE metrics ADD COLUMN is_baseline INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE metrics ADD COLUMN strategy TEXT DEFAULT 'mobile'", () => {});
        db.run("ALTER TABLE metrics ADD COLUMN screenshot_base64 TEXT", () => {});

        // ── Nuevas tablas para Automations (Fase 3) ──────────────────────────
        db.run(`
            CREATE TABLE IF NOT EXISTS cronjobs (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                url             TEXT    NOT NULL,
                strategy        TEXT    NOT NULL DEFAULT 'mobile',
                cron_expression TEXT    NOT NULL,
                active          INTEGER NOT NULL DEFAULT 1,
                created_at      DATETIME DEFAULT (datetime('now'))
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT NOT NULL,
                device      TEXT NOT NULL DEFAULT 'both',
                thresholds  TEXT NOT NULL,  -- JSON: {"lcp": 2.5, "score": 80}
                created_at  DATETIME DEFAULT (datetime('now'))
            )
        `);
    });

    export class Database {
        public static insertMetric(metric: any): Promise<void> {
            return new Promise((resolve, reject) => {
                const stmt = db.prepare('INSERT INTO metrics (url, timestamp, ttfb, lcp, cls, tbt, domSize, strategy, screenshot_base64) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
                stmt.run(
                    metric.url, metric.timestamp, metric.ttfb, metric.lcp, metric.cls, metric.tbt, metric.domSize, metric.strategy, metric.screenshot_base64,
                    (err: any) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
                stmt.finalize();
            });
        }

        public static getMetrics(): Promise<any[]> {
            return new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        m.*, 
                        b.lcp as baseline_lcp,
                        b.ttfb as baseline_ttfb,
                        b.tbt as baseline_tbt,
                        b.cls as baseline_cls
                    FROM metrics m
                    LEFT JOIN metrics b ON m.url = b.url AND b.is_baseline = 1
                    ORDER BY m.timestamp DESC 
                    LIMIT 50
                `;
                db.all(query, [], (err: any, rows: any[]) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }

        /**
         * Devuelve TODO el historial sin límite artificial.
         * Usado exclusivamente por el módulo Reports para exportación completa.
         */
        public static getAllMetrics(): Promise<any[]> {
            return new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        m.*,
                        b.lcp  as baseline_lcp,
                        b.ttfb as baseline_ttfb,
                        b.tbt  as baseline_tbt,
                        b.cls  as baseline_cls
                    FROM metrics m
                    LEFT JOIN metrics b ON m.url = b.url AND b.is_baseline = 1
                    ORDER BY m.timestamp DESC
                `;
                db.all(query, [], (err: any, rows: any[]) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }

        public static setBaseline(id: number): Promise<void> {
            return new Promise((resolve, reject) => {
                db.get('SELECT url FROM metrics WHERE id = ?', [id], (err: any, row: any) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error("URL no encontrada para ese ID"));
                    
                    db.serialize(() => {
                        // Desmarcar anteriores
                        db.run('UPDATE metrics SET is_baseline = 0 WHERE url = ?', [row.url]);
                        // Marcar nueva
                        db.run('UPDATE metrics SET is_baseline = 1 WHERE id = ?', [id], (err: any) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            });
        }

    public static getHistory7Days(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date,
                    AVG(lcp) as avgLcp,
                    AVG(tbt) as avgTbt,
                    AVG(cls) as avgCls
                FROM metrics
                WHERE timestamp >= (strftime('%s', 'now', '-7 days')) * 1000
                GROUP BY date
                ORDER BY date ASC
            `;
            db.all(query, [], (err: any, rows: any[]) => {
                if (err) reject(err);
                else {
                    const charted = rows.map(r => {
                        // Derivar una puntuación (Performance Score) simulada/calc de los avg vitals. 0-100.
                        let score = 100 - (r.avgTbt / 30) - (r.avgLcp / 150) - (r.avgCls * 100);
                        return {
                            date: r.date,
                            avgLcp: (r.avgLcp || 0), // pasamos en ms
                            avgScore: Math.min(100, Math.max(0, Math.round(score))) // clamp 0-100
                        };
                    });
                    resolve(charted);
                }
            });
        });
    }

    public static getUniqueUrls(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            db.all('SELECT DISTINCT url FROM metrics', [], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map((r: any) => r.url));
            });
        });
    }

    public static deleteMetric(id: number): Promise<void> {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM metrics WHERE id = ?', [id], function (err: any) {
                if (err) reject(err);
                // this.changes contiene las filas afectadas en un db.run de DELETE
                else if (this.changes === 0) reject(new Error('Record not found'));
                else resolve();
            });
        });
    }
}
