
import React, { useState, useEffect } from 'react';
import type { SystemSettings, UserProfile, UserRole } from '../types';
import SaveIcon from './icons/SaveIcon';
import CogIcon from './icons/CogIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import { getAllUsers, updateUserRole, updateUserProfile, getGlobalPatientData } from '../services/db';
import { useAuth } from '../contexts/AuthContext';

// Icons inlined for brevity in this specific update
const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
);
const CloudArrowDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
);
const XMarkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
);

interface AdminPanelProps {
  t: any;
}

type Tab = 'settings' | 'users' | 'global_data';

const RECOMMENDED_SOURCES = [
    "nih.gov", "pubmed.ncbi.nlm.nih.gov", "mayoclinic.org", "medlineplus.gov", 
    "fda.gov", "ema.europa.eu", "aemps.gob.es", "drugs.com", "medscape.com",
    "cpicpgx.org", "pharmgkb.org"
];

const AdminPanel: React.FC<AdminPanelProps> = ({ t }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  
  // Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    prioritySources: 'nih.gov, mayoclinic.org, drugs.com',
    excludedSources: 'wikipedia.org, social media',
    safetyStrictness: 'standard',
  });
  const [isSaved, setIsSaved] = useState(false);

  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleUpdateMsg, setRoleUpdateMsg] = useState<string | null>(null);
  
  // User Editing State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{displayName: string, institution: string}>({ displayName: '', institution: '' });

  // Global Data State
  const [isExportingGlobal, setIsExportingGlobal] = useState(false);

  useEffect(() => {
    // Load settings from local storage mock
    const saved = localStorage.getItem('system_config');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
      if (activeTab === 'users') {
          fetchUsers();
      }
  }, [activeTab]);

  const fetchUsers = async () => {
      if (!user) return;
      setLoadingUsers(true);
      try {
          const fetchedUsers = await getAllUsers(user.uid);
          setUsers(fetchedUsers);
      } catch (error) {
          console.error("Failed to fetch users");
      } finally {
          setLoadingUsers(false);
      }
  };

  const handleSettingsChange = (field: keyof SystemSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const addSource = (source: string) => {
      const current = settings.prioritySources.split(',').map(s => s.trim()).filter(Boolean);
      if (!current.includes(source)) {
          const newValue = [...current, source].join(', ');
          handleSettingsChange('prioritySources', newValue);
      }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('system_config', JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
      if (!user) return;
      try {
          await updateUserRole(user.uid, targetUid, newRole);
          setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role: newRole } : u));
          setRoleUpdateMsg(t.admin_users_role_updated);
          setTimeout(() => setRoleUpdateMsg(null), 3000);
      } catch (error) {
          console.error("Error updating role:", error);
      }
  };

  const startEditUser = (u: UserProfile) => {
      setEditingUserId(u.uid);
      setEditFormData({ 
          displayName: u.displayName || '', 
          institution: u.institution || '' 
      });
  };

  const cancelEditUser = () => {
      setEditingUserId(null);
      setEditFormData({ displayName: '', institution: '' });
  };

  const saveEditUser = async () => {
      if (!user || !editingUserId) return;
      try {
          await updateUserProfile(user.uid, editingUserId, editFormData);
          setUsers(prev => prev.map(u => u.uid === editingUserId ? { ...u, ...editFormData } : u));
          setRoleUpdateMsg(t.admin_users_profile_updated);
          setTimeout(() => setRoleUpdateMsg(null), 3000);
          setEditingUserId(null);
      } catch (error) {
          console.error("Error updating profile", error);
      }
  };

  const handleGlobalExport = async () => {
      if (!user) return;
      setIsExportingGlobal(true);
      try {
          const data = await getGlobalPatientData(user.uid);
          
          // Convert to CSV
          const headers = ['User / Owner', 'Patient ID', 'Medications', 'Conditions', 'Allergies', 'Pharmacogenetics', 'Last Updated'];
          const csvRows = [headers.join(',')];
          
          data.forEach(item => {
              const meds = item.patient.medications.map(m => m.name + (m.dosage ? ` (${m.dosage})` : '')).join('; ');
              const row = [
                  `"${item.user}"`,
                  `"${item.patient.id}"`,
                  `"${meds}"`,
                  `"${item.patient.conditions}"`,
                  `"${item.patient.allergies}"`,
                  `"${item.patient.pharmacogenetics}"`,
                  `"${item.patient.lastUpdated}"`
              ];
              csvRows.push(row.join(','));
          });

          const csvString = csvRows.join('\n');
          const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `global_study_export_${new Date().toISOString().slice(0,10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) {
          console.error("Global export failed", error);
          alert("Export failed. Check console or permissions.");
      } finally {
          setIsExportingGlobal(false);
      }
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center mb-6">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg mr-3">
            <CogIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Panel de Administración (Superuser)</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Control global del sistema y usuarios.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'settings' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
          >
              {t.admin_tab_settings}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
          >
              {t.admin_tab_users}
          </button>
          <button
            onClick={() => setActiveTab('global_data')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'global_data' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
          >
              {t.admin_tab_global_data}
          </button>
      </div>

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 gap-6 animate-fade-in">
            {/* Source Configuration */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Control de Fuentes de IA</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Define qué fuentes debe priorizar el modelo Gemini al buscar información médica y cuáles debe evitar explícitamente.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Fuentes Prioritarias (Dominios separados por coma)
                    </label>
                    <input
                        type="text"
                        value={settings.prioritySources}
                        onChange={(e) => handleSettingsChange('prioritySources', e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="ej: nih.gov, mayoclinic.org"
                    />
                    <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-500 mb-1">{t.admin_sources_library_title}:</p>
                        <div className="flex flex-wrap gap-1">
                            {RECOMMENDED_SOURCES.map(src => (
                                <button
                                    key={src}
                                    onClick={() => addSource(src)}
                                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-700 transition-colors"
                                >
                                    + {src}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fuentes Excluidas / Baja Confianza
                </label>
                <input
                    type="text"
                    value={settings.excludedSources}
                    onChange={(e) => handleSettingsChange('excludedSources', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    placeholder="ej: wikipedia.org, foros"
                />
                <p className="mt-1 text-xs text-slate-500">Se instruirá a la IA para evitar usar información de estos sitios.</p>
                </div>
            </div>
            </div>

            {/* Global Safety Settings */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Nivel de Seguridad</h3>
            <div className="flex space-x-4">
                {(['standard', 'strict', 'loose'] as const).map((mode) => (
                <button
                    key={mode}
                    onClick={() => handleSettingsChange('safetyStrictness', mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        settings.safetyStrictness === mode
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                >
                    {mode}
                </button>
                ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
                Controla cuán conservadora es la IA al generar alertas de riesgo (Standard es recomendado).
            </p>
            </div>

            <div className="mt-6 flex items-center justify-end">
                {isSaved && (
                    <span className="text-green-600 dark:text-green-400 flex items-center mr-4 text-sm font-medium animate-fade-in">
                        <CheckCircleIcon className="h-5 w-5 mr-1" />
                        Configuración guardada
                    </span>
                )}
                <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                    <SaveIcon className="h-5 w-5 mr-2" />
                    Guardar Cambios del Sistema
                </button>
            </div>
        </div>
      )}

      {activeTab === 'users' && (
          <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t.admin_users_title}</h3>
                  {roleUpdateMsg && (
                      <span className="text-green-600 text-sm flex items-center bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                          <CheckCircleIcon className="h-4 w-4 mr-1" /> {roleUpdateMsg}
                      </span>
                  )}
              </div>
              
              {loadingUsers ? (
                  <div className="text-center py-8 text-slate-500">Cargando usuarios...</div>
              ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                              <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.admin_users_table_name}</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.admin_users_table_institution}</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.admin_users_table_email}</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.admin_users_table_role}</th>
                                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                              </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                              {users.map((u) => (
                                  <tr key={u.uid}>
                                      {editingUserId === u.uid ? (
                                          // Editing Mode Row
                                          <>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input 
                                                    type="text" 
                                                    value={editFormData.displayName} 
                                                    onChange={(e) => setEditFormData({...editFormData, displayName: e.target.value})}
                                                    className="w-full text-sm border-slate-300 rounded px-2 py-1"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input 
                                                    type="text" 
                                                    value={editFormData.institution} 
                                                    onChange={(e) => setEditFormData({...editFormData, institution: e.target.value})}
                                                    className="w-full text-sm border-slate-300 rounded px-2 py-1"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{u.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded">{u.role}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={saveEditUser} className="text-green-600 hover:text-green-900 mr-3">{t.admin_edit_save}</button>
                                                <button onClick={cancelEditUser} className="text-red-600 hover:text-red-900">{t.admin_edit_cancel}</button>
                                            </td>
                                          </>
                                      ) : (
                                          // Display Mode Row
                                          <>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">
                                                        {u.displayName?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.displayName || 'Sin nombre'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {u.institution || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                {u.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                    className={`block w-full pl-3 pr-8 py-1 text-xs font-semibold rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 border-none cursor-pointer
                                                        ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                                            u.role === 'professional' ? 'bg-teal-100 text-teal-800' : 
                                                            'bg-slate-100 text-slate-800'}`}
                                                >
                                                    <option value="personal">Personal</option>
                                                    <option value="professional">Professional</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => startEditUser(u)} className="text-slate-400 hover:text-purple-600 transition-colors">
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                          </>
                                      )}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'global_data' && (
          <div className="animate-fade-in p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80">
              <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t.admin_global_export_title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
                  {t.admin_global_export_desc}
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg mb-6 flex items-start">
                  <span className="text-amber-600 dark:text-amber-400 mr-2">⚠️</span>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Nota de Seguridad:</strong> La exportación global filtra automáticamente los datos. Solo se incluyen registros pertenecientes a usuarios verificados con rol <strong>Profesional</strong> o <strong>Admin</strong>. Los datos de cuentas "Personal" se excluyen para garantizar la integridad clínica del estudio.
                  </p>
              </div>
              
              <button
                  onClick={handleGlobalExport}
                  disabled={isExportingGlobal}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                  {isExportingGlobal ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                  ) : (
                      <>
                        <CloudArrowDownIcon className="h-5 w-5 mr-2" />
                        {t.admin_global_export_button}
                      </>
                  )}
              </button>
          </div>
      )}
    </div>
  );
};

export default AdminPanel;
