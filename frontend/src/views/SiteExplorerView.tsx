// ─── Vista: Site Explorer ─────────────────────────────────────────────────────
// Fase futura: Árbol interactivo de todas las URLs rastreadas con historial
// de scores por ruta, comparación de versiones y drill-down por subpágina.

export default function SiteExplorerView() {
  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-charcoal-800 border border-charcoal-700/50 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-charcoal-200 mb-2">Site Explorer</h2>
      <p className="text-sm text-charcoal-500 max-w-md leading-relaxed">
        Árbol interactivo de todas las URLs rastreadas. Visualiza el historial de scores por ruta,
        compara versiones en el tiempo y haz drill-down por subpágina para identificar regresiones.
      </p>
      <div className="mt-8 px-4 py-2 rounded-full bg-charcoal-800 border border-charcoal-700/40">
        <span className="text-[11px] text-charcoal-500 uppercase tracking-widest font-medium">Próximamente · Fase 3</span>
      </div>
    </main>
  );
}
