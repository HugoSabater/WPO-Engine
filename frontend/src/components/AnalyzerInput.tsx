import { useState } from 'react';
import { enqueueAudit } from '../services/api';

interface AnalyzerInputProps {
  onAnalysisEnqueued: () => void;
}

export default function AnalyzerInput({ onAnalysisEnqueued }: AnalyzerInputProps) {
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setMessage(null);

    // Simple auto-prefix for UX
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    try {
      await enqueueAudit(finalUrl, strategy);
      setMessage({ 
        text: `Análisis en proceso. Los resultados aparecerán en la tabla en ~60 segundos.`, 
        type: 'success' 
      });
      onAnalysisEnqueued(); // Trigger polling in parent
      setUrl(''); // Clear input
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al encolar la URL.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://tutienda.com"
                className="w-full pl-10 pr-4 py-2.5 bg-charcoal-950 border border-charcoal-700 text-charcoal-100 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-charcoal-600"
                disabled={isLoading}
              />
            </div>
            <div className="flex bg-charcoal-900 border border-charcoal-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setStrategy('mobile')}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${strategy === 'mobile' ? 'bg-charcoal-700 text-blue-400' : 'text-charcoal-500 hover:text-charcoal-300'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                Móvil
              </button>
              <button
                type="button"
                onClick={() => setStrategy('desktop')}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${strategy === 'desktop' ? 'bg-charcoal-700 text-blue-400' : 'text-charcoal-500 hover:text-charcoal-300'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Escritorio
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center min-w-[150px] transition-all
                ${isLoading || !url.trim() 
                  ? 'bg-charcoal-800 text-charcoal-500 cursor-not-allowed border border-charcoal-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-500 border border-transparent shadow-lg shadow-blue-900/20'}`}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin text-charcoal-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Encolando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analizar URL
                </>
              )}
            </button>
          </form>
          {message && (
            <div className={`mt-3 text-sm flex items-start ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              <svg className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {message.type === 'success' 
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
              <p>{message.text}</p>
            </div>
          )}
        </div>
        <div className="hidden lg:flex items-center text-xs text-charcoal-500 border-l border-charcoal-800 pl-4 w-64 leading-relaxed">
          Las auditorías bajo demanda corren con prioridad máxima sobrevolando el Cron automático. No cierres esta ventana.
        </div>
      </div>
    </div>
  );
}
