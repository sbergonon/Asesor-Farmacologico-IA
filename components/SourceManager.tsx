
import React, { useState, useMemo } from 'react';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import GlobeAltIcon from './icons/GlobeAltIcon';
import XIcon from './icons/XIcon';

interface SourceManagerProps {
  title: string;
  description: string;
  sourcesString: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  variant: 'priority' | 'excluded';
  t: any;
}

const SourceManager: React.FC<SourceManagerProps> = ({ 
  title, 
  description, 
  sourcesString, 
  onChange, 
  placeholder = "ej: mayoclinic.org",
  variant,
  t
}) => {
  const [newSource, setNewSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sourcesList = useMemo(() => {
    return sourcesString
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [sourcesString]);

  const validateSource = (input: string) => {
    // Validación básica de dominio o URL
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-2]{2,63}$/i;
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
    return domainRegex.test(input) || urlRegex.test(input);
  };

  const handleAdd = () => {
    const trimmed = newSource.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!trimmed) return;
    
    if (!validateSource(trimmed)) {
      setError(t.admin_source_invalid_error || "URL o dominio no válido");
      return;
    }

    if (sourcesList.includes(trimmed)) {
      setError(t.admin_source_duplicate_error || "Esta fuente ya existe");
      return;
    }

    const updated = [...sourcesList, trimmed].join(', ');
    onChange(updated);
    setNewSource('');
    setError(null);
  };

  const handleRemove = (sourceToRemove: string) => {
    const updated = sourcesList
      .filter(s => s !== sourceToRemove)
      .join(', ');
    onChange(updated);
  };

  const handleClearAll = () => {
    if (confirm(t.admin_source_clear_confirm || "¿Limpiar todas las fuentes?")) {
      onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const isPriority = variant === 'priority';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center ${isPriority ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GlobeAltIcon className={`h-4 w-4 ${isPriority ? 'text-blue-500' : 'text-red-500'}`} />
            {title}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
        {sourcesList.length > 0 && (
          <button onClick={handleClearAll} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest">
            {t.admin_source_clear_btn || "Limpiar"}
          </button>
        )}
      </div>
      
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newSource}
            onChange={(e) => { setNewSource(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`flex-grow px-3 py-2 bg-white dark:bg-slate-900 border ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
          />
          <button
            onClick={handleAdd}
            disabled={!newSource.trim()}
            className={`p-2 ${isPriority ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50 text-white rounded-lg transition-colors shadow-sm`}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-[10px] text-red-500 mb-4 font-bold">{error}</p>}

        <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
          {sourcesList.length > 0 ? (
            sourcesList.map((source) => (
              <div 
                key={source} 
                className="group flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate mr-2">{source}</span>
                <button
                  onClick={() => handleRemove(source)}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400 italic">{t.admin_sources_empty || "No hay fuentes configuradas"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SourceManager;
