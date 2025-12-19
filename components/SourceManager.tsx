
import React, { useState, useMemo } from 'react';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

interface SourceManagerProps {
  title: string;
  description: string;
  sourcesString: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  variant: 'priority' | 'excluded';
}

const SourceManager: React.FC<SourceManagerProps> = ({ 
  title, 
  description, 
  sourcesString, 
  onChange, 
  placeholder = "ej: mayoclinic.org",
  variant
}) => {
  const [newSource, setNewSource] = useState('');

  const sourcesList = useMemo(() => {
    return sourcesString
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [sourcesString]);

  const handleAdd = () => {
    const trimmed = newSource.trim().toLowerCase();
    if (!trimmed) return;
    
    if (!sourcesList.includes(trimmed)) {
      const updated = [...sourcesList, trimmed].join(', ');
      onChange(updated);
    }
    setNewSource('');
  };

  const handleRemove = (sourceToRemove: string) => {
    const updated = sourcesList
      .filter(s => s !== sourceToRemove)
      .join(', ');
    onChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const isPriority = variant === 'priority';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-700 ${isPriority ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
      
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-grow px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newSource.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors shadow-sm"
            title="Añadir fuente"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>

        {sourcesList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sourcesList.map((source) => (
              <span 
                key={source} 
                className={`inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  isPriority 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800' 
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800'
                }`}
              >
                {source}
                <button
                  onClick={() => handleRemove(source)}
                  className={`hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 rounded-full ${
                    isPriority ? 'hover:bg-blue-200 dark:hover:bg-blue-800' : 'hover:bg-red-200 dark:hover:bg-red-800'
                  }`}
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 border-2 border-dashed border-slate-100 dark:border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400 italic">No hay fuentes configuradas.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceManager;
