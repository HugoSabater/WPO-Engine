import { Request, Response } from 'express';
import * as cheerio from 'cheerio';

// Dominios de redes sociales a excluir siempre
const SOCIAL_BLOCKLIST = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    'whatsapp.com', 't.me', 'telegram.me',
];

function isSocialDomain(hostname: string): boolean {
    return SOCIAL_BLOCKLIST.some(s => hostname === s || hostname.endsWith('.' + s));
}

/**
 * GET /api/crawl?url=<URL>&limit=<N>
 *
 * Descarga el HTML de `url`, extrae todos los hrefs de <a>,
 * filtra solo los enlaces internos del mismo dominio, excluye
 * anclas, mailto:, redes sociales y devuelve un array único
 * limitado por `limit` (default 10, max 50).
 */
export const CrawlerController = {
    async crawl(req: Request, res: Response): Promise<void> {
        const rawUrl = req.query.url as string | undefined;
        const limit  = Math.min(Number(req.query.limit) || 10, 50);

        // ── Validación ────────────────────────────────────────────────────────
        if (!rawUrl) {
            res.status(400).json({ error: 'El parámetro "url" es obligatorio.' });
            return;
        }

        let base: URL;
        try {
            base = new URL(rawUrl);
        } catch {
            res.status(400).json({ error: 'URL inválida. Incluye http:// o https://' });
            return;
        }

        // ── Fetch del HTML ────────────────────────────────────────────────────
        let html: string;
        try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 15_000); // 15s timeout
            const response   = await fetch(rawUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'WPO-Engine-Crawler/2.0 (+https://github.com/floressolidarias)' },
            });
            clearTimeout(timeout);

            if (!response.ok) {
                res.status(502).json({ error: `La URL respondió con status ${response.status}.` });
                return;
            }
            html = await response.text();
        } catch (err: any) {
            const msg = err.name === 'AbortError'
                ? 'Timeout: la URL tardó más de 15 segundos en responder.'
                : `Error al hacer fetch: ${err.message}`;
            res.status(502).json({ error: msg });
            return;
        }

        // ── Parseo con Cheerio ────────────────────────────────────────────────
        const $ = cheerio.load(html);
        const found = new Set<string>();

        $('a[href]').each((_i: number, el: cheerio.Element) => {
            const href = $(el).attr('href')?.trim();
            if (!href) return;

            // Excluir anclas, javascript:, mailto:, tel:
            if (href.startsWith('#') || href.startsWith('mailto:') ||
                href.startsWith('tel:') || href.startsWith('javascript:')) return;

            let resolved: URL;
            try {
                resolved = new URL(href, base.origin); // resuelve rutas relativas
            } catch {
                return; // href malformado
            }

            // Solo mismo dominio (hostname exacto)
            if (resolved.hostname !== base.hostname) return;

            // Excluir redes sociales (por si el dominio propio redirige)
            if (isSocialDomain(resolved.hostname)) return;

            // Normalizar: sin fragment, sin trailing slash doble
            resolved.hash = '';
            const clean = resolved.href.replace(/\/$/, '') || base.origin;
            found.add(clean);

            if (found.size >= limit) return false as any; // early exit de each()
        });

        const urls = Array.from(found).slice(0, limit);

        console.log(`[Crawler] ${rawUrl} → ${urls.length} URLs internas encontradas (limit=${limit})`);
        res.status(200).json({ base: rawUrl, total: urls.length, urls });
    },
};
