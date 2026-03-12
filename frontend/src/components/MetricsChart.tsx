import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '../types';

interface MetricsChartProps {
  data: ChartDataPoint[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-charcoal-800 border border-charcoal-600/50 rounded-lg p-3 shadow-xl text-xs">
        <p className="text-charcoal-300 mb-2 font-medium">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-charcoal-300">{p.name}:</span>
            <span className="font-semibold text-charcoal-100">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function MetricsChart({ data }: MetricsChartProps) {
  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-200">Evolución de Rendimiento</h2>
          <p className="text-xs text-charcoal-400 mt-0.5">Página de inicio · Últimos 7 días</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-charcoal-400">
            <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
            Performance Score
          </span>
          <span className="flex items-center gap-1.5 text-charcoal-400">
            <span className="w-3 h-0.5 bg-violet-500 inline-block rounded" />
            LCP (ms)
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="score" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="lcp" orientation="right" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="performanceScore"
            name="Performance Score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="lcp"
            type="monotone"
            dataKey="lcp"
            name="LCP (ms)"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
