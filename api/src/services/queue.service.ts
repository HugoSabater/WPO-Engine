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
}
