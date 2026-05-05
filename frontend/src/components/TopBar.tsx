import type { ReactNode } from 'react';
import type { QueueStatus } from '../services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type ActiveView = 'dashboard' | 'explorer' | 'automations' | 'reports';

interface NavItem {
  id: ActiveView;
  label: string;
  icon: ReactNode;
}

interface TopBarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  queueStatus: QueueStatus;
}

// ─── Iconos inline (sin dependencia de librerías) ────────────────────────────
const iconDashboard = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const iconExplorer = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);
const iconAutomations = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconReports = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    label: 'Dashboard',      icon: iconDashboard },
  { id: 'explorer',     label: 'Site Explorer',  icon: iconExplorer },
  { id: 'automations',  label: 'Automations',    icon: iconAutomations },
  { id: 'reports',      label: 'Reports',        icon: iconReports },
];

// ─── HUD de Cola ──────────────────────────────────────────────────────────────
function QueueHUD({ status }: { status: QueueStatus }) {
  const hasBusy = (status.waiting + status.active) > 0;

  return (
    <div className="flex items-center gap-2">
      {hasBusy ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          <span className="text-[11px] font-medium text-amber-300 whitespace-nowrap">
            {status.active > 0
              ? `⚙️ Analizando (${status.active} activo${status.active > 1 ? 's' : ''})`
              : `⏳ En cola (${status.waiting} pendiente${status.waiting > 1 ? 's' : ''})`}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-charcoal-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          Cola limpia
        </div>
      )}

      {status.failed > 0 && (
        <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
          <span className="text-[10px] text-red-400 font-mono">
            ⚠ {status.failed} fallido{status.failed > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TopBar Principal ─────────────────────────────────────────────────────────
export default function TopBar({ activeView, setActiveView, queueStatus }: TopBarProps) {
  return (
    <header className="border-b border-charcoal-800/80 bg-charcoal-950/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 grid grid-cols-3 items-center gap-4">

        {/* ── Columna izquierda: Logo ── */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-charcoal-100 leading-tight tracking-tight">
              WPO Analytics Engine
            </h1>
            <p className="text-[10px] text-charcoal-500 leading-tight hidden sm:block">
              WordPress / WooCommerce
            </p>
          </div>
        </div>

        {/* ── Columna central: Navegación ── */}
        <nav className="flex items-center justify-center">
          <ul className="flex items-center gap-0.5 p-0.5 rounded-xl bg-charcoal-900/60 border border-charcoal-800/60">
            {NAV_ITEMS.map(({ id, label, icon }) => {
              const isActive = activeView === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => setActiveView(id)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                      transition-all duration-150 whitespace-nowrap
                      ${isActive
                        ? 'bg-charcoal-700 text-charcoal-100 shadow-sm'
                        : 'text-charcoal-500 hover:text-charcoal-300 hover:bg-charcoal-800/60'
                      }
                    `}
                  >
                    <span className={isActive ? 'text-yellow-300' : 'text-charcoal-600'}>
                      {icon}
                    </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Columna derecha: HUD de cola ── */}
        <div className="flex items-center justify-end gap-3">
          <QueueHUD status={queueStatus} />
          <span className="text-[10px] text-charcoal-600 hidden lg:block border-l border-charcoal-800 pl-3">
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

      </div>
    </header>
  );
}
