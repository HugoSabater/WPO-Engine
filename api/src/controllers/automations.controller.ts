import { Request, Response } from 'express';
import { AutomationsService, CreateCronJobDto, CreateAlertDto, Strategy, AlertDevice } from '../services/automations.service';

// ─── Validadores inline (sin librerías externas) ──────────────────────────────
const VALID_STRATEGIES: Strategy[]    = ['mobile', 'desktop'];
const VALID_DEVICES: AlertDevice[]    = ['mobile', 'desktop', 'both'];
const VALID_METRICS                   = ['score', 'lcp', 'ttfb', 'cls', 'tbt'];
const CRON_REGEX                      = /^(\S+\s){4}\S+$/; // 5 campos mínimo

function isValidUrl(value: string): boolean {
    try { new URL(value); return true; }
    catch { return false; }
}

export class AutomationsController {

    // ── Cronjobs ──────────────────────────────────────────────────────────────

    /** GET /api/cronjobs */
    public static async getCronjobs(req: Request, res: Response): Promise<void> {
        try {
            const data = await AutomationsService.getCronjobs();
            res.status(200).json({ data });
        } catch (err) {
            console.error('[AutomationsController] getCronjobs:', err);
            res.status(500).json({ error: 'Error obteniendo cronjobs.' });
        }
    }

    /** POST /api/cronjobs */
    public static async addCronjob(req: Request, res: Response): Promise<void> {
        try {
            const { url, strategy, cron_expression } = req.body as CreateCronJobDto;

            if (!url || !isValidUrl(url))
                return void res.status(400).json({ error: 'URL inválida.' });
            if (!VALID_STRATEGIES.includes(strategy))
                return void res.status(400).json({ error: 'Strategy debe ser "mobile" o "desktop".' });
            if (!cron_expression || !CRON_REGEX.test(cron_expression.trim()))
                return void res.status(400).json({ error: 'Expresión CRON inválida (se esperan 5 campos).' });

            const row = await AutomationsService.addCronjob({ url, strategy, cron_expression: cron_expression.trim() });
            res.status(201).json({ data: row });
        } catch (err) {
            console.error('[AutomationsController] addCronjob:', err);
            res.status(500).json({ error: 'Error creando cronjob.' });
        }
    }

    /** PATCH /api/cronjobs/:id/toggle */
    public static async toggleCronjob(req: Request, res: Response): Promise<void> {
        try {
            const id     = parseInt(req.params.id, 10);
            const active = req.body?.active;

            if (isNaN(id))             return void res.status(400).json({ error: 'ID inválido.' });
            if (typeof active !== 'boolean') return void res.status(400).json({ error: 'Campo "active" (boolean) requerido.' });

            await AutomationsService.toggleCronjob(id, active);
            res.status(200).json({ success: true });
        } catch (err: any) {
            if (err.message === 'Cronjob not found') res.status(404).json({ error: 'Cronjob no encontrado.' });
            else { console.error('[AutomationsController] toggleCronjob:', err); res.status(500).json({ error: 'Error actualizando cronjob.' }); }
        }
    }

    /** DELETE /api/cronjobs/:id */
    public static async deleteCronjob(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) return void res.status(400).json({ error: 'ID inválido.' });
            await AutomationsService.deleteCronjob(id);
            res.status(204).send();
        } catch (err: any) {
            if (err.message === 'Cronjob not found') res.status(404).json({ error: 'Cronjob no encontrado.' });
            else { console.error('[AutomationsController] deleteCronjob:', err); res.status(500).json({ error: 'Error eliminando cronjob.' }); }
        }
    }

    // ── Alerts ────────────────────────────────────────────────────────────────

    /** GET /api/alerts */
    public static async getAlerts(req: Request, res: Response): Promise<void> {
        try {
            const data = await AutomationsService.getAlerts();
            res.status(200).json({ data });
        } catch (err) {
            console.error('[AutomationsController] getAlerts:', err);
            res.status(500).json({ error: 'Error obteniendo alertas.' });
        }
    }

    /** POST /api/alerts */
    public static async addAlert(req: Request, res: Response): Promise<void> {
        try {
            const { email, device, thresholds } = req.body as CreateAlertDto;

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return void res.status(400).json({ error: 'Email inválido.' });
            if (!VALID_DEVICES.includes(device))
                return void res.status(400).json({ error: 'Device debe ser "mobile", "desktop" o "both".' });
            if (!thresholds || typeof thresholds !== 'object' || Object.keys(thresholds).length === 0)
                return void res.status(400).json({ error: 'Se requiere al menos un umbral.' });

            // Validar que todas las claves son métricas válidas y los valores son números
            for (const [k, v] of Object.entries(thresholds)) {
                if (!VALID_METRICS.includes(k))
                    return void res.status(400).json({ error: `Métrica inválida: "${k}".` });
                if (typeof v !== 'number' || isNaN(v) || v < 0)
                    return void res.status(400).json({ error: `Umbral inválido para "${k}": debe ser un número >= 0.` });
            }

            const row = await AutomationsService.addAlert({ email, device, thresholds });
            res.status(201).json({ data: row });
        } catch (err) {
            console.error('[AutomationsController] addAlert:', err);
            res.status(500).json({ error: 'Error creando alerta.' });
        }
    }

    /** DELETE /api/alerts/:id */
    public static async deleteAlert(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) return void res.status(400).json({ error: 'ID inválido.' });
            await AutomationsService.deleteAlert(id);
            res.status(204).send();
        } catch (err: any) {
            if (err.message === 'Alert not found') res.status(404).json({ error: 'Alerta no encontrada.' });
            else { console.error('[AutomationsController] deleteAlert:', err); res.status(500).json({ error: 'Error eliminando alerta.' }); }
        }
    }
}
