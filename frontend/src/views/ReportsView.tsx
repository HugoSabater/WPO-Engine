// ─── Vista: Reports ───────────────────────────────────────────────────────────
// Fase futura: Motor de exportación. Descarga de informes en PDF visual
// (con gráficas de tendencia) o CSV plano para análisis externo.

export default function ReportsView() {
  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-charcoal-800 border border-charcoal-700/50 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-charcoal-200 mb-2">Reports</h2>
      <p className="text-sm text-charcoal-500 max-w-md leading-relaxed">
        Motor de exportación de informes de rendimiento. Descarga análisis completos en
        <strong className="text-charcoal-400"> PDF visual</strong> (con gráficas de tendencia e indicadores de color)
        o en <strong className="text-charcoal-400">CSV plano</strong> para su procesamiento en herramientas externas.
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm w-full">
        {[
          { label: 'PDF Visual', desc: 'Con gráficas y semáforos CWV' },
          { label: 'CSV / Excel',  desc: 'Datos crudos para análisis externo' },
        ].map(f => (
          <div key={f.label} className="rounded-lg border border-charcoal-700/30 bg-charcoal-800/40 px-4 py-3 text-left">
            <p className="text-xs font-medium text-charcoal-300 mb-0.5">{f.label}</p>
            <p className="text-[10px] text-charcoal-600">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 px-4 py-2 rounded-full bg-charcoal-800 border border-charcoal-700/40">
        <span className="text-[11px] text-charcoal-500 uppercase tracking-widest font-medium">Próximamente · Fase 3</span>
      </div>
    </main>
  );
}
