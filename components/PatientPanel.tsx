import React, { useState, useMemo } from 'react';
import type { PatientProfile } from '../types';
import UserGroupIcon from './icons/UserGroupIcon';
import TrashIcon from './icons/TrashIcon';
import SearchIcon from './icons/SearchIcon';

interface PatientPanelProps {
  profiles: PatientProfile[];
  onLoadProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  t: any;
}

const PatientPanel: React.FC<PatientPanelProps> = ({ profiles, onLoadProfile, onDeleteProfile, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => p.id.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [profiles, searchTerm]);
  
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProfileToDelete(id);
  };

  const confirmDelete = () => {
    if (profileToDelete) {
      onDeleteProfile(profileToDelete);
      setProfileToDelete(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 h-full">
      <div className="flex items-center mb-4">
        <UserGroupIcon className="h-6 w-6 mr-3 text-blue-500" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.patients_panel_title}</h2>
      </div>
      
      <div className="relative mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.patients_search_placeholder}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-slate-400"/>
        </div>
      </div>
      
      {filteredProfiles.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {filteredProfiles.map((profile) => {
             const lastUpdatedDate = new Date(profile.lastUpdated);
             const formattedDate = lastUpdatedDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
             });
             const formattedTime = lastUpdatedDate.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
             });
            
            return (
              <div key={profile.id} className="w-full text-left p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors duration-200 flex justify-between items-center">
                <button onClick={() => onLoadProfile(profile.id)} className="flex-grow text-left">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{profile.id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.patients_last_updated.replace('{date}', `${formattedDate} ${formattedTime}`)}
                  </p>
                </button>
                <div className="flex-shrink-0 flex items-center space-x-2 ml-4">
                   <button
                    onClick={() => onLoadProfile(profile.id)}
                    className="px-3 py-1 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                   >
                     {t.patients_load_button}
                   </button>
                   <button
                    onClick={(e) => handleDeleteClick(e, profile.id)}
                    className="p-2 rounded-full text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                   >
                     <TrashIcon className="h-5 w-5" />
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          {t.patients_empty}
        </p>
      )}

      {profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={() => setProfileToDelete(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-11/12 max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.patients_delete_confirm_title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t.patients_delete_confirm.replace('{patientId}', profileToDelete)}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setProfileToDelete(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">{t.patients_cancel_button}</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">{t.patients_delete_button}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPanel;
