
import React from 'react';
import DocumentTextIcon from './icons/DocumentTextIcon';
import HistoryIcon from './icons/HistoryIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import { useAuth } from '../contexts/AuthContext';
import ProBadge from './ProBadge';
import CogIcon from './icons/CogIcon';
import SearchIcon from './icons/SearchIcon';

type TabId = 'form' | 'patients' | 'history' | 'dashboard' | 'admin' | 'investigator';

interface TabSelectorProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  t: any;
}

const TabSelector: React.FC<TabSelectorProps> = ({ activeTab, setActiveTab, t }) => {
  const { permissions } = useAuth();
  
  // Define available tabs - Reordered: History is now second
  const tabs = [
    { 
      id: 'form', 
      name: t.tab_new_analysis, 
      icon: DocumentTextIcon, 
      isVisible: true 
    },
    { 
      id: 'history', 
      name: t.tab_history, 
      icon: HistoryIcon, 
      isVisible: true 
    },
    { 
      id: 'patients', 
      name: t.tab_patients, 
      icon: UserGroupIcon, 
      isVisible: permissions.canManagePatients, 
      isPro: true
    },
    { 
      id: 'investigator', 
      name: t.tab_investigator, 
      icon: SearchIcon, 
      isVisible: permissions.canAccessInvestigator,
      isPro: true
    },
    { 
      id: 'dashboard', 
      name: t.tab_dashboard, 
      icon: ChartBarIcon, 
      isVisible: permissions.canAccessDashboard,
      isPro: true
    },
    {
      id: 'admin',
      name: 'Admin',
      icon: CogIcon,
      isVisible: permissions.canConfigureSystem, // Admin only
      isPro: false
    }
  ];

  const visibleTabs = tabs.filter(tab => tab.isVisible);

  // Compacted styles: 
  // On Mobile (default): Flex column or simple block.
  // On Tablet (sm): Flex row with scroll.
  // On Desktop (lg): Grid layout (auto-cols-fr) to force equal distribution and NO SCROLL.
  const getButtonClass = (tabId: TabId) => {
    const baseClass = "w-full inline-flex items-center justify-center px-2 py-2 font-medium text-xs sm:text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 focus:ring-blue-500 truncate";
    if (activeTab === tabId) {
      return `${baseClass} bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400`;
    }
    return `${baseClass} text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50`;
  };

  return (
    <div className="p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl flex flex-col sm:flex-row lg:grid lg:grid-flow-col lg:auto-cols-fr gap-1 overflow-x-auto lg:overflow-visible scrollbar-hide">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabId)}
          className={getButtonClass(tab.id as TabId)}
          title={tab.name} // Tooltip for very small screens if truncated
        >
          <tab.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 flex-shrink-0" />
          <span className="truncate">{tab.name}</span>
          {tab.isPro && <ProBadge />}
        </button>
      ))}
    </div>
  );
};

export default TabSelector;
