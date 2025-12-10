
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface HeaderProps {
  appName: string;
  appDescription: string;
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ml-2 ${colorClass}`}>
      {label}
    </span>
  );
};

const Header: React.FC<HeaderProps> = ({ appName, appDescription }) => {
  const { userProfile, logout } = useAuth();

  return (
    <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
      <div className="text-center md:text-left flex-grow">
        <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">
          {appName}
        </h1>
        <p className="mt-2 text-md text-slate-600 dark:text-slate-300">
          {appDescription}
        </p>
      </div>
      
      {userProfile && (
        <div className="flex items-center bg-white dark:bg-slate-800/80 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          {userProfile.photoURL ? (
            <img src={userProfile.photoURL} alt="User" className="h-8 w-8 rounded-full" />
          ) : (
             <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-200 font-bold">
               {userProfile.displayName?.charAt(0) || 'U'}
             </div>
          )}
          <div className="ml-3 hidden sm:block text-left mr-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {userProfile.displayName} 
              <RoleBadge role={userProfile.role} />
            </p>
          </div>
          <button 
            onClick={() => logout()}
            className="ml-2 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
