import React, { useState } from 'react';
import { Principal, TenantInfo } from '../contracts/types';
import { Shield, Activity, User, ChevronDown, Check, Server, Terminal, Lock, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  currentPrincipal: Principal | null;
  principals: Principal[];
  tenants: TenantInfo[];
  onSwitchPrincipal: (actorId: string) => void;
  health: any;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPrincipal,
  principals,
  tenants,
  onSwitchPrincipal,
  health,
  activeTab,
  onSelectTab,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t.tabOverview },
    { id: 'agents', label: t.tabAgentStudio },
    { id: 'workflows', label: t.tabWorkflowDAG },
    { id: 'approvals', label: t.tabGovernance },
    { id: 'org', label: t.tabOrgMembers },
    { id: 'tools', label: t.tabIntegrationHub },
    { id: 'metal3', label: t.tabMetal3 },
    { id: 'audits', label: t.tabAuditTrail },
    { id: 'matrix', label: t.tabMatrix },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-white">{t.platformTitle}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-semibold">
                    V2.0-P0-1
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{t.platformSubtitle}</p>
              </div>
            </div>

            {/* Health pill */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{t.statusHealthy}</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 text-[11px]">{t.policyVersion}</span>
            </div>
          </div>

          {/* Right Controls: Tenant & Identity Switcher & Language Switcher */}
          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
              <button
                onClick={() => setLanguage('zh')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                  language === 'zh'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="切换为中文"
              >
                <span>中</span>
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to English"
              >
                <span>EN</span>
              </button>
            </div>

            {/* Tenant indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/60 border border-slate-800 text-xs">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">{t.tenantLabel}:</span>
              <span className="font-medium text-slate-200">{currentPrincipal?.tenant_name || 'Acme Enterprise'}</span>
            </div>

            {/* Principal Selector */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-left transition"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-900/60 border border-indigo-600/50 flex items-center justify-center text-indigo-300 font-bold text-[11px]">
                  {currentPrincipal?.actor_name?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-medium text-slate-200 text-xs leading-none">
                    {currentPrincipal?.actor_name?.split(' ')[0] || 'User'}
                  </div>
                  <div className="text-[10px] text-indigo-400 font-mono mt-0.5 leading-none">
                    {currentPrincipal?.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.switchPrincipalTitle}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.switchPrincipalDesc}</div>
                  </div>
                  <div className="space-y-1">
                    {principals.map((p) => {
                      const isCurrent = p.actor_id === currentPrincipal?.actor_id;
                      return (
                        <button
                          key={p.actor_id}
                          onClick={() => {
                            onSwitchPrincipal(p.actor_id);
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                            isCurrent
                              ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                              : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{p.actor_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {t.roleLabel}: <span className="text-indigo-400">{p.role}</span> | {t.grantsLabel}: {p.grants.join(', ')}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
