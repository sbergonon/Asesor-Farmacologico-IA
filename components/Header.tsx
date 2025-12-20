
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import GlobeAltIcon from './icons/GlobeAltIcon';

interface HeaderProps {
  appName: string;
  appDescription: string;
  currentLang: 'es' | 'en';
  onLangChange: (lang: 'es' | 'en') => void;
  t: any;
}

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  let colorClass = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  let label: string = role;

  if (role === 'admin') {
    colorClass = 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
    label = 'Admin';
  } else if (role === 'professional') {
    colorClass = 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300';
    label = 'Pro';
  } else {
    label = 'Personal';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide ml-2 ${colorClass}`}>
      {label}
    </span>
  );
};

const Header: React.FC<HeaderProps> = ({ appName, appDescription, currentLang, onLangChange, t }) => {
  const { userProfile, logout } = useAuth();

  return (
    <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 sm:mb-8">
      <div className="text-center md:text-left flex-grow">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 tracking-tight">
          {appName}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto md:mx-0">
          {appDescription}
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-3 self-center md:self-auto">
        {/* Language Selector */}
        <div className="flex items-center bg-white dark:bg-slate-800/80 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
           <div className="px-2 text-slate-400">
             <GlobeAltIcon className="h-4 w-4" />
           </div>
           <select 
             value={currentLang} 
             onChange={(e) => onLangChange(e.target.value as 'es' | 'en')}
             className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none pr-2 py-1 cursor-pointer"
             aria-label={t.language_selector_label}
           >
             <option value="es">{t.lang_es}</option>
             <option value="en">{t.lang_en}</option>
           </select>
        </div>

        {userProfile && (
          <div className="flex items-center justify-center md:justify-end bg-white dark:bg-slate-800/80 p-1.5 sm:p-2 rounded-full md:rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt="User" className="h-8 w-8 rounded-full" />
            ) : (
               <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-200 font-bold text-xs">
                 {userProfile.displayName?.charAt(0) || 'U'}
               </div>
            )}
            <div className="ml-3 hidden sm:block text-left mr-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
                {userProfile.displayName} 
                <RoleBadge role={userProfile.role} />
              </p>
            </div>
            <button 
              onClick={() => logout()}
              className="ml-2 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-transparent hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
