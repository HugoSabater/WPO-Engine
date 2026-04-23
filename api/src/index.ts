import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { WPOController } from './controllers/wpo.controller';
import { AutomationsController } from './controllers/automations.controller';
import { QueueService } from './services/queue.service';
import { Database } from './models/database';

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Endpoints de auditoría
app.post('/api/audit/batch', WPOController.enqueueBatchAudit);
app.post('/api/audit/ondemand', WPOController.enqueueOnDemand);
app.post('/api/audit/baseline', WPOController.setBaseline);
app.get('/api/audit/metrics', WPOController.getMetrics);
app.get('/api/audit/all',     WPOController.getAllMetrics);  // Reports: sin límite
app.get('/api/audit/history', WPOController.getHistory);
app.delete('/api/audit/:id', WPOController.deleteAudit);
// Estado y gestión en tiempo real de la cola BullMQ
app.get('/api/queue/status',       WPOController.getQueueStatus);
app.post('/api/queue/clean-failed', WPOController.cleanFailedJobs);

// ── Automations: Cronjobs ────────────────────────────────────────────────────
app.get('/api/cronjobs',                AutomationsController.getCronjobs);
app.post('/api/cronjobs',               AutomationsController.addCronjob);
app.patch('/api/cronjobs/:id/toggle',   AutomationsController.toggleCronjob);
app.delete('/api/cronjobs/:id',         AutomationsController.deleteCronjob);

// ── Automations: Alertas ─────────────────────────────────────────────────────
app.get('/api/alerts',     AutomationsController.getAlerts);
app.post('/api/alerts',    AutomationsController.addAlert);
app.delete('/api/alerts/:id', AutomationsController.deleteAlert);

const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`[API] Orchestrator running on 0.0.0.0:${PORT}`);

    // Purga automática de jobs fallidos del arranque anterior (pre-hotfix)
    try {
        const purged = await QueueService.cleanFailed();
        if (purged > 0) console.log(`[API] Auto-purga: ${purged} jobs fallidos eliminados de Redis.`);
    } catch (err) {
        console.warn('[API] No se pudo auto-purgar failed jobs:', err);
    }
    
    // Configurar Cron Diario Dinámicamente
    try {
        const uniqueUrls = await Database.getUniqueUrls();
        if (uniqueUrls.length > 0) {
            await QueueService.setupDailyCron(uniqueUrls);
        } else {
            console.log('[API] Tabla vacía. Esperando análisis On-Demand para iniciar cron.');
        }
    } catch (err) {
        console.error('[API] Error configurando crons base de datos:', err);
    }
});
