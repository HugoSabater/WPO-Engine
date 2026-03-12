import sqlite3 from 'sqlite3';
import { resolve } from 'path';

const dbPath = process.env.NODE_ENV === 'development' 
    ? resolve(__dirname, '../../wpo-historics.sqlite') 
    : '/app/db/wpo-historics.sqlite';

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
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
}
