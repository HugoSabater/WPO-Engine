import { Worker, Job } from 'bullmq';
import { Database } from '../models/database.js'; 
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';


const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379
};

// Concurrencia estricta bloqueada en 2 para prevenir colapso RAM/CPU CPU
export const wpoWorker = new Worker('LighthouseAudit', async (job: Job) => {
    const { url, timestamp, strategy = 'mobile' } = job.data;
    console.log(`[Worker] Iniciando análisis para: ${url} (${strategy})`);

    // Flags ultra eficientes para RAM y contenedores Docker (shm prevendrá cuelgues)
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer',
            '--remote-debugging-port=9222',
            '--remote-debugging-address=0.0.0.0',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/google/chrome/chrome',
        headless: true,
        ignoreHTTPSErrors: true,
        protocolTimeout: 0,
        dumpio: true
    });

    try {
        const port = new URL(browser.wsEndpoint()).port;

        const lhOptions = {
            logLevel: 'error' as const,
            output: 'json' as const,
            onlyCategories: ['performance'],
            port: Number(port),
            formFactor: strategy,
            screenEmulation: {
                mobile: strategy === 'mobile',
                width: strategy === 'mobile' ? 412 : 1350,
                height: strategy === 'mobile' ? 823 : 940,
                deviceScaleFactor: strategy === 'mobile' ? 1.75 : 1,
                disabled: false
            }
        };

        const runnerResult = await lighthouse(url, lhOptions);
        if (!runnerResult) throw new Error('Lighthouse returned undefined');
        const audits = runnerResult.lhr.audits;

        const metrics = {
            url: url,
            timestamp: timestamp,
            ttfb: audits['server-response-time']?.numericValue || 0,
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            tbt: audits['total-blocking-time']?.numericValue || 0,
            domSize: audits['dom-size']?.numericValue || 0,
            strategy: strategy,
            screenshot_base64: (audits['full-page-screenshot']?.details as any)?.screenshot?.data || null
        };

        await Database.insertMetric(metrics);
        
        console.log(`[Worker] Análisis completado con éxito para: ${url}`);
        return metrics;

    } catch (error) {
        console.error(`[Worker] Falla crítica al analizar ${url}:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}, { 
    connection, 
    concurrency: 2 
});
