import { Request, Response } from 'express';
import { QueueService } from '../services/queue.service';
import { Database } from '../models/database';

export class WPOController {
    
    public static async enqueueBatchAudit(req: Request, res: Response): Promise<void> {
        try {
            const { urls } = req.body;

            if (!Array.isArray(urls) || urls.length === 0) {
                res.status(400).json({ error: 'Payload requires an array of URLs.' });
                return;
            }

            if (urls.length > 50) {
                res.status(413).json({ error: 'Payload exceeds the maximum allowed length of 50 URLs.' });
                return;
            }

            const jobIds = await QueueService.addBatch(urls);

            res.status(202).json({
                message: `Accepted ${urls.length} URLs for WPO analysis.`,
                queued_jobs: jobIds
            });
        } catch (error) {
            console.error('[WPOController] Error enqueueing batch:', error);
            res.status(500).json({ error: 'Internal Server Error processing queue.' });
        }
    }

    public static async getMetrics(req: Request, res: Response): Promise<void> {
        try {
            const rows = await Database.getMetrics();
            res.status(200).json({ data: rows });
        } catch (error) {
            console.error('[WPOController] Error fetching metrics:', error);
            res.status(500).json({ error: 'Internal Server Error fetching data.' });
        }
    }

    public static async getHistory(req: Request, res: Response): Promise<void> {
        try {
            const rows = await Database.getHistory7Days();
            res.status(200).json({ data: rows });
        } catch (error) {
            console.error('[WPOController] Error fetching history:', error);
            res.status(500).json({ error: 'Internal Server Error fetching historical data.' });
        }
    }

    public static async enqueueOnDemand(req: Request, res: Response): Promise<void> {
        try {
            const { url, strategy = 'mobile' } = req.body;

            if (!url || typeof url !== 'string') {
                res.status(400).json({ error: 'Payload requires a valid url string.' });
                return;
            }

            if (strategy !== 'mobile' && strategy !== 'desktop') {
                res.status(400).json({ error: 'Strategy must be "mobile" or "desktop".' });
                return;
            }

            try {
                new URL(url); // Validación de URL
            } catch {
                res.status(400).json({ error: 'Formato de URL inválido. Incluye http:// o https://' });
                return;
            }

            const jobId = await QueueService.addPriority(url, strategy);

            res.status(202).json({
                message: `Análisis WPO encolado para ${url} (${strategy})`,
                job_id: jobId
            });
        } catch (error) {
            console.error('[WPOController] Error enqueueing on-demand:', error);
            res.status(500).json({ error: 'Internal Server Error procesando análisis bajo demanda.' });
        }
    }

    public static async setBaseline(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.body;
            if (id == null) {
                res.status(400).json({ error: 'Se requiere ID del escaneo.' });
                return;
            }
            await Database.setBaseline(id);
            res.status(200).json({ success: true, message: 'Baseline actualizado.' });
        } catch (error) {
            console.error('[WPOController] Error setting baseline:', error);
            res.status(500).json({ error: 'Internal Server Error fijando baseline.' });
        }
    }

    public static async deleteAudit(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ error: 'ID inválido. Debe ser un número.' });
                return;
            }
            await Database.deleteMetric(id);
            res.status(204).send();
        } catch (error: any) {
            if (error.message === 'Record not found') {
                res.status(404).json({ error: 'Auditoría no encontrada.' });
            } else {
                console.error('[WPOController] Error deleting audit:', error);
                res.status(500).json({ error: 'Internal Server Error eliminando auditoría.' });
            }
        }
    }

    /**
     * GET /api/queue/status
     * Retorna snapshot de contadores BullMQ para el polling del Frontend HUD.
     */
    public static async getQueueStatus(req: Request, res: Response): Promise<void> {
        try {
            const status = await QueueService.getStatus();
            res.status(200).json(status);
        } catch (error) {
            console.error('[WPOController] Error fetching queue status:', error);
            res.status(500).json({ error: 'Error obteniendo estado de la cola.' });
        }
    }

    /**
     * POST /api/queue/clean-failed
     * Purga manualmente todos los jobs en estado "failed" de BullMQ.
     */
    public static async cleanFailedJobs(req: Request, res: Response): Promise<void> {
        try {
            const count = await QueueService.cleanFailed();
            res.status(200).json({ message: `${count} jobs fallidos purgados.`, cleaned: count });
        } catch (error) {
            console.error('[WPOController] Error limpiando failed jobs:', error);
            res.status(500).json({ error: 'Error purgando jobs fallidos.' });
        }
    }
}
