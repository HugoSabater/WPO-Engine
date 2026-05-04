import { useState, useEffect, useRef } from 'react';
import {
  getCronjobs,   createCronjob,  toggleCronjob as apiToggleCronjob, deleteCronjob as apiDeleteCronjob,
  getAlerts,     createAlert,    deleteAlert   as apiDeleteAlert,
  type CronJobRow, type AlertRow, type Strategy, type AlertDevice, type AlertMetric,
} from '../services/api';
import { translateCron, formatLastRun } from '../utils/wpoTranslator';

// ─── Tipos locales UI (no expuestos hacia afuera) ─────────────────────────────
type CronMode = 'basic' | 'advanced';

interface CronBasic {
  mode: 'basic';
  freq: 'daily' | 'weekly';
  day:  string;
  hour: string;
}
interface CronAdvanced {
  mode: 'advanced';
  expr: string;
}
type CronConfig = CronBasic | CronAdvanced;

// MetricThresholds en UI se maneja como strings (inputs), se convierten a number al enviar
type MetricThresholds = Partial<Record<AlertMetric, string>>;

// ─── Constantes de UI ─────────────────────────────────────────────────────────
const METRIC_DEFS: { key: AlertMetric; label: string; unit: string; placeholder: string }[] = [
  { key: 'score', label: 'Score',  unit: '',    placeholder: '50'   },
  { key: 'lcp',   label: 'LCP',    unit: 's',   placeholder: '2.5'  },
  { key: 'ttfb',  label: 'TTFB',   unit: 'ms',  placeholder: '1800' },
  { key: 'cls',   label: 'CLS',    unit: '',    placeholder: '0.25' },
  { key: 'tbt',   label: 'TBT',    unit: 'ms',  placeholder: '600'  },
];

const DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

function buildCronExpr(cfg: CronBasic): string {
  if (cfg.freq === 'daily') return `0 ${cfg.hour} * * *`;
  return `0 ${cfg.hour} * * ${cfg.day}`;
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────
const INPUT_CLS = [
  'w-full bg-charcoal-800 border border-charcoal-700/60 rounded-lg px-3 py-2',
  'text-sm text-charcoal-200 placeholder-charcoal-600',
  'focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30',
  'transition-colors',
].join(' ');

const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;
const LABEL_CLS  = 'block text-[11px] font-medium text-charcoal-400 uppercase tracking-wider mb-1.5';

// ─── Componente: Badge de estado ──────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
      ${active
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-charcoal-700/40 text-charcoal-500 border border-charcoal-700/30'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-charcoal-600'}`} />
      {active ? 'Activo' : 'Pausado'}
    </span>
  );
}

// ─── Componente: Constructor CRON Visual ──────────────────────────────────────
function CronBuilder({ value, onChange }: {
  value: CronConfig;
  onChange: (cfg: CronConfig) => void;
}) {
  const isBasic = value.mode === 'basic';

  const setMode = (mode: CronMode) => {
    if (mode === 'basic') onChange({ mode: 'basic', freq: 'daily', day: '1', hour: '3' });
    else                  onChange({ mode: 'advanced', expr: '0 3 * * *' });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex rounded-lg border border-charcoal-700/50 overflow-hidden text-[11px] font-medium">
        {(['basic', 'advanced'] as CronMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 transition-colors
              ${value.mode === m
                ? 'bg-charcoal-700 text-charcoal-100'
                : 'bg-charcoal-800/40 text-charcoal-500 hover:text-charcoal-300'}`}
          >
            {m === 'basic' ? '🗓 Básico' : '⌨ Avanzado'}
          </button>
        ))}
      </div>

      {isBasic ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL_CLS}>Frecuencia</label>
            <select
              value={(value as CronBasic).freq}
              onChange={e => onChange({ ...(value as CronBasic), freq: e.target.value as 'daily' | 'weekly' })}
              className={SELECT_CLS}
            >
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Día</label>
            <select
              value={(value as CronBasic).day}
              onChange={e => onChange({ ...(value as CronBasic), day: e.target.value })}
              disabled={(value as CronBasic).freq === 'daily'}
              className={`${SELECT_CLS} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Hora</label>
            <select
              value={(value as CronBasic).hour}
              onChange={e => onChange({ ...(value as CronBasic), hour: e.target.value })}
              className={SELECT_CLS}
            >
              {HOURS.map((h, i) => <option key={i} value={String(i)}>{h}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className={LABEL_CLS}>Expresión CRON</label>
          <input
            type="text"
            value={(value as CronAdvanced).expr}
            onChange={e => onChange({ mode: 'advanced', expr: e.target.value })}
            placeholder="0 3 * * 1-5"
            className={`${INPUT_CLS} font-mono`}
          />
          <p className="text-[10px] text-charcoal-600 mt-1">
            Formato: <span className="font-mono">min hora día mes día_sem</span> ·{' '}
            <a
              href="https://crontab.guru"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              crontab.guru ↗
            </a>
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-charcoal-900/60 border border-charcoal-700/30">
        <span className="text-[10px] text-charcoal-500">Expresión:</span>
        <code className="text-[11px] font-mono text-emerald-400">
          {isBasic ? buildCronExpr(value as CronBasic) : (value as CronAdvanced).expr || '—'}
        </code>
      </div>
    </div>
  );
}

// ─── Componente: Selector multi-métrica ───────────────────────────────────────
function MetricSelector({ thresholds, onChange }: {
  thresholds: MetricThresholds;
  onChange: (t: MetricThresholds) => void;
}) {
  const toggleMetric = (key: AlertMetric) => {
    const next = { ...thresholds };
    if (key in next) { delete next[key]; }
    else              { next[key] = ''; }
    onChange(next);
  };

  const setThreshold = (key: AlertMetric, val: string) => {
    onChange({ ...thresholds, [key]: val });
  };

  const selected = METRIC_DEFS.filter(m => m.key in thresholds);

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_CLS}>Métricas a vigilar</label>
        <div className="flex flex-wrap gap-1.5">
          {METRIC_DEFS.map(({ key, label }) => {
            const isOn = key in thresholds;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleMetric(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-150
                  ${isOn
                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                    : 'bg-charcoal-800/60 border-charcoal-700/40 text-charcoal-500 hover:text-charcoal-300 hover:border-charcoal-600'
                  }`}
              >
                {isOn && <span className="mr-1">✓</span>}
                {label}
              </button>
            );
          })}
        </div>
        {selected.length === 0 && (
          <p className="text-[10px] text-charcoal-600 mt-1.5">Selecciona al menos una métrica.</p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {selected.map(({ key, label, unit, placeholder }) => (
            <div key={key}>
              <label className={LABEL_CLS}>
                Umbral {label}{unit && <span className="normal-case tracking-normal ml-0.5 text-charcoal-600">({unit})</span>}
              </label>
              <input
                type="number"
                step="any"
                value={thresholds[key] ?? ''}
                onChange={e => setThreshold(key, e.target.value)}
                placeholder={placeholder}
                className={INPUT_CLS}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Columna 1: CronjobsPanel ───────────────────────────────────────────────────────────
function CronjobsPanel({ initialUrl = '', onPrefillConsumed }: {
  initialUrl?:         string;
  onPrefillConsumed?:  () => void;
}) {
  const [jobs,     setJobs]     = useState<CronJobRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [url,      setUrl]      = useState(initialUrl);
  const [strategy, setStrategy] = useState<Strategy>('mobile');
  const [cronCfg,  setCronCfg]  = useState<CronConfig>({ mode: 'basic', freq: 'daily', day: '1', hour: '3' });
  const formRef = useRef<HTMLFormElement>(null);

  // Sincronizar cuando llega un prefill desde Reports
  useEffect(() => {
    if (!initialUrl) return;
    setUrl(initialUrl);
    // Scroll suave al formulario para que el usuario lo vea
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    onPrefillConsumed?.();
  // Solo reaccionar cuando cambia initialUrl (no en cada render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const resolveCron = (cfg: CronConfig): string =>
    cfg.mode === 'basic' ? buildCronExpr(cfg) : cfg.expr;

  // Carga inicial desde el backend
  useEffect(() => {
    getCronjobs()
      .then(data => setJobs(data))
      .catch(err  => console.error('[CronjobsPanel] getCronjobs:', err))
      .finally(()  => setLoading(false));
  }, []);

  const handleToggle = async (job: CronJobRow) => {
    const nextActive = !job.active;
    try {
      await apiToggleCronjob(job.id, nextActive);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, active: nextActive } : j));
    } catch (err) {
      console.error('[CronjobsPanel] toggleCronjob:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDeleteCronjob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      console.error('[CronjobsPanel] deleteCronjob:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      const created = await createCronjob({
        url:             url.trim(),
        strategy,
        cron_expression: resolveCron(cronCfg),
      });
      setJobs(prev => [created, ...prev]);
      setUrl('');
    } catch (err) {
      console.error('[CronjobsPanel] createCronjob:', err);
    }
  };

  return (
    <div className="card flex flex-col gap-5">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-charcoal-100">Tareas Programadas</h2>
          <p className="text-[10px] text-charcoal-500">Cronjobs de análisis automático</p>
        </div>
        <span className="ml-auto text-[11px] font-mono text-charcoal-500 bg-charcoal-800 px-2 py-0.5 rounded">
          {jobs.filter(j => j.active).length}/{jobs.length} activos
        </span>
      </div>

      {/* Formulario */}
      <form ref={formRef} onSubmit={handleCreate} className="bg-charcoal-800/40 border border-charcoal-700/30 rounded-xl p-4 space-y-4">
        <p className="text-[10px] text-charcoal-500 uppercase tracking-widest font-semibold">Nueva tarea</p>

        <div>
          <label className={LABEL_CLS}>URL a analizar</label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://floressolidarias.org/ramos"
            className={`${INPUT_CLS} ${url ? 'border-blue-500/50 ring-1 ring-blue-500/20' : ''}`}
            required
          />
        </div>

        <div>
          <label className={LABEL_CLS}>Dispositivo</label>
          <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)} className={SELECT_CLS}>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLS}>Programación</label>
          <CronBuilder value={cronCfg} onChange={setCronCfg} />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Tarea
        </button>
      </form>

      {/* Lista */}
      <div className="space-y-2">
        {loading && (
          <p className="text-xs text-charcoal-600 text-center py-6 animate-pulse">Cargando tareas…</p>
        )}
        {!loading && jobs.length === 0 && (
          <p className="text-xs text-charcoal-600 text-center py-6">No hay tareas configuradas.</p>
        )}
        {jobs.map(job => (
          <div key={job.id} className={`rounded-lg border p-3 transition-colors
            ${job.active ? 'bg-charcoal-800/50 border-charcoal-700/40' : 'bg-charcoal-900/30 border-charcoal-800/40 opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-mono text-charcoal-200 truncate">{job.url}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-charcoal-500 capitalize">{job.strategy}</span>
                  <span className="text-charcoal-700">·</span>
                  {/* Texto legible en lugar de la expresión cron técnica */}
                  <span className="text-[10px] text-emerald-400/80">{translateCron(job.cron_expression)}</span>
                  <span className="text-charcoal-700">·</span>
                  <code className="text-[10px] font-mono text-charcoal-700" title={job.cron_expression}>
                    {job.cron_expression}
                  </code>
                  <span className="text-charcoal-700">·</span>
                  <span className="text-[10px] text-charcoal-600">Último: {formatLastRun(job.last_run)}</span>
                </div>
              </div>
              <StatusBadge active={job.active} />
            </div>
            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-charcoal-700/30">
              <button
                onClick={() => handleToggle(job)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded transition-colors
                  ${job.active ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
              >
                {job.active ? '⏸ Pausar' : '▶ Activar'}
              </button>
              <button
                onClick={() => handleDelete(job.id)}
                className="text-[11px] font-medium text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors ml-auto"
              >
                🗑 Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Columna 2: AlertsPanel ───────────────────────────────────────────────────
function AlertsPanel() {
  const [alerts,     setAlerts]     = useState<AlertRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [email,      setEmail]      = useState('');
  const [thresholds, setThresholds] = useState<MetricThresholds>({});
  const [device,     setDevice]     = useState<AlertDevice>('both');

  const deviceLabel: Record<AlertDevice, string> = { mobile: 'Mobile', desktop: 'Desktop', both: 'Ambos' };

  // Carga inicial desde el backend
  useEffect(() => {
    getAlerts()
      .then(data => setAlerts(data))
      .catch(err  => console.error('[AlertsPanel] getAlerts:', err))
      .finally(()  => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await apiDeleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('[AlertsPanel] deleteAlert:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasThreshold = Object.keys(thresholds).length > 0 &&
      Object.values(thresholds).every(v => v !== '');
    if (!email.trim() || !hasThreshold) return;

    // Convertir strings del formulario a números (el backend requiere typeof v === 'number')
    const numericThresholds = Object.fromEntries(
      Object.entries(thresholds).map(([k, v]) => [k, parseFloat(v as string)])
    ) as Record<AlertMetric, number>;

    try {
      const created = await createAlert({ email: email.trim(), device, thresholds: numericThresholds });
      setAlerts(prev => [created, ...prev]);
      setEmail('');
      setThresholds({});
    } catch (err) {
      console.error('[AlertsPanel] createAlert:', err);
    }
  };

  return (
    <div className="card flex flex-col gap-5">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-charcoal-100">Alertas de Rendimiento</h2>
          <p className="text-[10px] text-charcoal-500">Notificaciones por correo al superar umbrales</p>
        </div>
        <span className="ml-auto text-[11px] font-mono text-charcoal-500 bg-charcoal-800 px-2 py-0.5 rounded">
          {alerts.length} regla{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Formulario */}
      <form onSubmit={handleCreate} className="bg-charcoal-800/40 border border-charcoal-700/30 rounded-xl p-4 space-y-4">
        <p className="text-[10px] text-charcoal-500 uppercase tracking-widest font-semibold">Nueva alerta</p>

        <div>
          <label className={LABEL_CLS}>Correo destinatario</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="marketing@floressolidarias.org"
            className={INPUT_CLS}
            required
          />
        </div>

        <MetricSelector thresholds={thresholds} onChange={setThresholds} />

        <div>
          <label className={LABEL_CLS}>Dispositivo</label>
          <select value={device} onChange={e => setDevice(e.target.value as AlertDevice)} className={SELECT_CLS}>
            <option value="both">Ambos</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Crear Alerta
        </button>
      </form>

      {/* Lista de alertas */}
      <div className="space-y-2">
        {loading && (
          <p className="text-xs text-charcoal-600 text-center py-6 animate-pulse">Cargando alertas…</p>
        )}
        {!loading && alerts.length === 0 && (
          <p className="text-xs text-charcoal-600 text-center py-6">No hay alertas configuradas.</p>
        )}
        {alerts.map(alert => (
          <div key={alert.id}
            className="rounded-lg border border-charcoal-700/40 bg-charcoal-800/50 p-3 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-mono text-charcoal-200 truncate">{alert.email}</p>

              <div className="flex flex-wrap gap-1">
                {METRIC_DEFS
                  .filter(m => m.key in alert.thresholds)
                  .map(m => (
                    <span key={m.key}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-300 font-medium font-mono"
                    >
                      {m.label}&nbsp;{m.key === 'score' ? '<' : '>'}&nbsp;{alert.thresholds[m.key]}{m.unit}
                    </span>
                  ))}
              </div>

              <p className="text-[10px] text-charcoal-500 capitalize">{deviceLabel[alert.device]}</p>
            </div>

            <button
              onClick={() => handleDelete(alert.id)}
              className="flex-shrink-0 text-charcoal-600 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/10"
              title="Eliminar alerta"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vista Principal ───────────────────────────────────────────────────────────────────
export default function AutomationsView({ prefillUrl = '', onPrefillConsumed }: {
  prefillUrl?:         string;
  onPrefillConsumed?:  () => void;
}) {
  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-charcoal-100">Automations</h2>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Gestiona cronjobs de análisis periódicos y alertas multimétrica por correo electrónico.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <CronjobsPanel initialUrl={prefillUrl} onPrefillConsumed={onPrefillConsumed} />
        <AlertsPanel />
      </div>
    </main>
  );
}
