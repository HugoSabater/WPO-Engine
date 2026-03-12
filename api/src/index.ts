import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { WPOController } from './controllers/wpo.controller';
import { QueueService } from './services/queue.service';
import { Database } from './models/database';

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Endpoints
app.post('/api/audit/batch', WPOController.enqueueBatchAudit);
app.post('/api/audit/ondemand', WPOController.enqueueOnDemand);
app.post('/api/audit/baseline', WPOController.setBaseline);
app.get('/api/audit/metrics', WPOController.getMetrics);
app.get('/api/audit/history', WPOController.getHistory);
app.delete('/api/audit/:id', WPOController.deleteAudit);

const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`[API] Orchestrator running on 0.0.0.0:${PORT}`);
    
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
