'use client';

import { Clock, House, MagnifyingGlass, Plus, Star } from '@phosphor-icons/react';
import { useTranslation } from '../hooks/useTranslation';
import { useTeamStore, type SidebarView } from '../state/teamStore';
import { TeamSelector } from './TeamSelector';

type NavItem = {
  id: SidebarView;
  labelKey: 'sidebarHome' | 'sidebarRecent' | 'sidebarStarred';
  icon: typeof House;
};

const navItems: NavItem[] = [
  { id: 'home', labelKey: 'sidebarHome', icon: House },
  { id: 'recent', labelKey: 'sidebarRecent', icon: Clock },
  { id: 'starred', labelKey: 'sidebarStarred', icon: Star },
];

type AppSidebarProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
};

export function AppSidebar({ searchQuery, onSearchChange }: AppSidebarProps) {
  const { t } = useTranslation();
  const sidebarView = useTeamStore((s) => s.sidebarView);
  const setSidebarView = useTeamStore((s) => s.setSidebarView);

  return (
    <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Team selector */}
      <div className="border-b border-slate-100 p-2">
        <TeamSelector />
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchByTitle}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = sidebarView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSidebarView(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={18} weight={active ? 'fill' : 'regular'} />
              {t[item.labelKey]}
            </button>
          );
        })}

        {/* Spaces placeholder */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.spaces}
            </span>
            <button
              type="button"
              disabled
              className="rounded p-0.5 text-slate-300"
              title={t.spaces}
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        </div>
      </nav>
    </aside>
  );
}
