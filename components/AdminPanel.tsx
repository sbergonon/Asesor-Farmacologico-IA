import React, { useState, useEffect } from 'react';
import type { SystemSettings, UserProfile, UserRole } from '../types';
import SaveIcon from './icons/SaveIcon';
import CogIcon from './icons/CogIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import GlobeAltIcon from './icons/GlobeAltIcon';
import BoltIcon from './icons/BoltIcon';
import InfoCircleIcon from './icons/InfoCircleIcon';
import PencilIcon from './icons/PencilIcon';
import CloudArrowDownIcon from './icons/CloudArrowDownIcon';
import SourceManager from './SourceManager';
import { getAllUsers, updateUserRole, updateUserProfile, getGlobalPatientData } from '../services/db';
import { useAuth } from '../contexts/AuthContext';

interface AdminPanelProps {
  t: any;
}

type Tab = 'settings' | 'users' | 'global_data' | 'connectivity';

const AdminPanel: React.FC<AdminPanelProps> = ({ t }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  
  const [settings, setSettings] = useState<SystemSettings>({
    prioritySources: 'nih.gov, mayoclinic.org, drugs.com, medscape.com',
    excludedSources: 'wikipedia.org, social media',
    safetyStrictness: 'standard',
    integrations: [
        { id: '1', name: 'Servidor FHIR Principal', type: 'EHR', protocol: 'FHIR', endpoint: 'https://fhir.hospital.org/v4', status: 'inactive' },
        { id: '2', name: 'Gateway Farmacovigilancia', type: 'Pharmacovigilance', protocol: 'Webhook', endpoint: 'https://pv.agency.gov/api', status: 'inactive' }
    ]
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleUpdateMsg, setRoleUpdateMsg] = useState<string | null>(null);
  const [isExportingGlobal, setIsExportingGlobal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('system_config');
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  useEffect(() => {
      if (activeTab === 'users') fetchUsers();
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

  const handleSettingsChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('system_config', JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestConnection = () => {
      setIsTestingConn(true);
      setTimeout(() => {
          setIsTestingConn(false);
          alert("Error de conexión: Certificado TLS del servidor remoto no verificado. Configure el Proxy FHIR en GCP (Simulado).");
      }, 2000);
  };

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
      if (!user) return;
      try {
          await updateUserRole(user.uid, targetUid, newRole);
          setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role: newRole } : u));
          setRoleUpdateMsg(t.admin_users_role_updated);
          setTimeout(() => setRoleUpdateMsg(null), 3000);
      } catch (error) {}
  };

  const handleGlobalExport = async () => {
      if (!user) return;
      setIsExportingGlobal(true);
      try {
          const data = await getGlobalPatientData(user.uid);
          const headers = ['User', 'Patient ID', 'Medications', 'Conditions', 'Allergies', 'Pharmacogenetics', 'Last Updated'];
          const csvRows = [headers.join(',')];
          data.forEach(item => {
              const meds = item.patient.medications.map(m => m.name).join('; ');
              const row = [`"${item.user}"`, `"${item.patient.id}"`, `"${meds}"`, `"${item.patient.conditions}"`, `"${item.patient.allergies}"`, `"${item.patient.pharmacogenetics}"`, `"${item.patient.lastUpdated}"`];
              csvRows.push(row.join(','));
          });
          const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `global_export_${new Date().toISOString().slice(0,10)}.csv`;
          link.click();
      } catch (error) {
          alert("Export failed.");
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
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Panel de Administración</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Control global del sistema e interoperabilidad.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
          <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100'}`}>
              {t.admin_tab_settings}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100'}`}>
              {t.admin_tab_users}
          </button>
          <button onClick={() => setActiveTab('global_data')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'global_data' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100'}`}>
              {t.admin_tab_global_data}
          </button>
          <button onClick={() => setActiveTab('connectivity')} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all ${activeTab === 'connectivity' ? 'bg-purple-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100'}`}>
              <GlobeAltIcon className="h-4 w-4 mr-1.5" />
              {t.admin_tab_connectivity}
          </button>
      </div>

      {activeTab === 'settings' && (
          <div className="animate-fade-in space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SourceManager 
                    title="Fuentes Prioritarias"
                    description="Dominios médicos de confianza que la IA consultará preferentemente."
                    sourcesString={settings.prioritySources}
                    onChange={(val) => handleSettingsChange('prioritySources', val)}
                    variant="priority"
                  />
                  <SourceManager 
                    title="Fuentes Excluidas"
                    description="Dominios bloqueados para evitar sesgos o información no contrastada."
                    sourcesString={settings.excludedSources}
                    onChange={(val) => handleSettingsChange('excludedSources', val)}
                    variant="excluded"
                    placeholder="ej: wikipedia.org"
                  />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold mb-3">Seguridad del Modelo</h3>
                  <div className="flex gap-4">
                      {['loose', 'standard', 'strict'].map((level) => (
                          <label key={level} className="flex items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name="safety" 
                                checked={settings.safetyStrictness === level} 
                                onChange={() => handleSettingsChange('safetyStrictness', level)}
                                className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-sm capitalize text-slate-700 dark:text-slate-300">{level}</span>
                          </label>
                      ))}
                  </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {isSaved && (
                      <span className="flex items-center text-green-600 dark:text-green-400 text-sm animate-fade-in">
                          <CheckCircleIcon className="h-4 w-4 mr-1.5" /> Cambios guardados
                      </span>
                  )}
                  <button 
                    onClick={handleSaveSettings} 
                    className="inline-flex items-center px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    <SaveIcon className="h-4 w-4 mr-2" /> Guardar Configuración
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">{t.admin_users_title}</h3>
                  {roleUpdateMsg && <span className="text-sm text-green-600 font-medium">{roleUpdateMsg}</span>}
              </div>
              
              {loadingUsers ? (
                <div className="py-12 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-slate-500 italic">Cargando directorio...</p>
                </div>
              ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">{t.admin_users_table_name}</th>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">{t.admin_users_table_email}</th>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">{t.admin_users_table_role}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                              {users.map(u => (
                                  <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <td className="px-4 py-3 font-medium">{u.displayName}</td>
                                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                                      <td className="px-4 py-3">
                                          <select 
                                            value={u.role} 
                                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)} 
                                            className="bg-slate-100 dark:bg-slate-900 border-none rounded px-2 py-1 text-xs font-bold uppercase focus:ring-1 focus:ring-purple-500"
                                          >
                                              <option value="personal">Personal</option>
                                              <option value="professional">Professional</option>
                                              <option value="admin">Admin</option>
                                          </select>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'global_data' && (
          <div className="animate-fade-in p-6 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                  <CloudArrowDownIcon className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t.admin_global_export_title}</h3>
              <p className="text-sm text-slate-500 max-w-lg mb-8">{t.admin_global_export_desc}</p>
              <button 
                onClick={handleGlobalExport}
                disabled={isExportingGlobal}
                className="inline-flex items-center px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                  {isExportingGlobal ? 'Generando CSV...' : t.admin_global_export_button}
              </button>
          </div>
      )}

      {activeTab === 'connectivity' && (
          <div className="animate-fade-in space-y-6">
              <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/80">
                  <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t.admin_connectivity_title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t.admin_connectivity_desc}</p>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.admin_connectivity_fhir_label}</label>
                          <div className="flex gap-2">
                              <input type="url" value={settings.integrations?.find(i => i.type === 'EHR')?.endpoint || ''} className="flex-grow px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm sm:text-sm focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="https://fhir.provider.org/v4" />
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800">Inactive</span>
                          </div>
                      </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                      <button onClick={handleTestConnection} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center">
                          <BoltIcon className="h-4 w-4 mr-2" />
                          {t.admin_connectivity_test_btn}
                      </button>
                      <button onClick={handleSaveSettings} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-md">
                          {t.admin_connectivity_save_btn}
                      </button>
                  </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-6 rounded-xl">
                  <div className="flex items-center space-x-2 mb-4">
                      <InfoCircleIcon className="h-6 w-6 text-indigo-600" />
                      <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200">{t.admin_connectivity_docs_title}</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                          <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 uppercase tracking-wide">{t.admin_connectivity_docs_step1}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.admin_connectivity_docs_step1_desc}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                          <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 uppercase tracking-wide">{t.admin_connectivity_docs_step2}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.admin_connectivity_docs_step2_desc}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                          <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 uppercase tracking-wide">{t.admin_connectivity_docs_step3}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.admin_connectivity_docs_step3_desc}</p>
                      </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-indigo-800">
                      <p className="text-[10px] text-slate-400 italic font-medium uppercase tracking-widest">{t.admin_connectivity_disclaimer}</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminPanel;
