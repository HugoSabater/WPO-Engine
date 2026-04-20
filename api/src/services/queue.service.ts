import { Queue } from 'bullmq';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379
};

const lighthouseQueue = new Queue('LighthouseAudit', { connection });

export class QueueService {
    public static async addBatch(urls: string[]): Promise<string[]> {
        const jobs = urls.map(url => ({
            name: 'audit-url',
            data: { url, timestamp: Date.now() },
            opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
        }));
        
        const addedJobs = await lighthouseQueue.addBulk(jobs);
        return addedJobs.map((job: any) => (job.id as string) || 'unknown');
    }

    public static async addPriority(url: string, strategy: string = 'mobile'): Promise<string> {
        const job = await lighthouseQueue.add(
            'audit-url',
            { url, timestamp: Date.now(), strategy },
            { 
                priority: 1, // Mayor prioridad que el cron (default)
                attempts: 2,
                backoff: { type: 'exponential', delay: 2000 }
            }
        );
        console.log(`[QueueService] Añadido URL Prioritaria a cola: ${url}`);
        return (job.id as string) || 'unknown';
    }

    public static async setupDailyCron(urls: string[]): Promise<void> {
        // En BullMQ, configurar repeatable jobs
        for (const url of urls) {
            await lighthouseQueue.add(
                'audit-url',
                { url },
                { 
                    repeat: { pattern: '0 3 * * *' }, // Todos los días a las 3:00 AM (usando pattern para BullMQ >= 4.0)
                    jobId: `daily_cron_${Buffer.from(url).toString('base64').substring(0,20)}`,
                    attempts: 3, 
                    backoff: { type: 'exponential', delay: 2000 }
                }
            );
        }
        console.log(`[QueueService] Tareas cron diarias programadas (03:00) para ${urls.length} URLs.`);
    }

    /**
     * Devuelve un snapshot de los contadores vitales de BullMQ.
     * El frontend hace polling cada 3 s para renderizar el HUD de estado.
     */
    public static async getStatus(): Promise<{ waiting: number; active: number; delayed: number; failed: number }> {
        const counts = await lighthouseQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        return {
            waiting: counts.waiting  ?? 0,
            active:  counts.active   ?? 0,
            delayed: counts.delayed  ?? 0,
            failed:  counts.failed   ?? 0,
        };
    }

    /**
     * Purga todos los jobs en estado 'failed' de la cola BullMQ.
     * Útil para limpiar el historial de errores pre-hotfix (puerto 9222).
     */
    public static async cleanFailed(): Promise<number> {
        const cleaned = await lighthouseQueue.clean(0, 1000, 'failed');
        console.log(`[QueueService] Purgados ${cleaned.length} jobs fallidos de la cola.`);
        return cleaned.length;
    }
}
