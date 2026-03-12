import { PriorityInsight } from '../types';

interface PriorityCardsProps {
  insights: PriorityInsight[];
}

const severityConfig = {
  critical: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/5',
    dot: 'bg-red-500',
    badge: 'badge-red',
    label: 'CRÍTICO',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    dot: 'bg-amber-500',
    badge: 'badge-amber',
    label: 'ALERTA',
  },
  ok: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
    dot: 'bg-emerald-500',
    badge: 'badge-green',
    label: 'OK',
  },
};

export default function PriorityCards({ insights }: PriorityCardsProps) {
  if (!insights.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {insights.map((insight) => {
        const cfg = severityConfig[insight.severity];
        return (
          <div
            key={insight.id}
            className={`card border ${cfg.border} ${cfg.bg} relative overflow-hidden`}
          >
            <div className={`absolute top-0 left-0 w-1 h-full ${cfg.dot}`} />
            <div className="pl-3">
              <div className="flex items-center justify-between mb-2">
                <span className={cfg.badge}>{cfg.label}</span>
                <span className="text-xs text-charcoal-400 font-mono">{insight.metric}</span>
              </div>
              <div className="text-2xl font-bold text-charcoal-100 mb-1">{insight.value}</div>
              <div className="text-sm font-semibold text-charcoal-200 mb-1">{insight.title}</div>
              <p className="text-xs text-charcoal-400 leading-relaxed">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
