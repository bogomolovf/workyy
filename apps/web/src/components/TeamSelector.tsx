'use client';

import { CaretDown, Check, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import * as Popover from '@radix-ui/react-popover';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { createWorkspace, fetchCurrentUser } from '../lib/api';
import { useAuthStore } from '../state/authStore';
import { useTeamStore } from '../state/teamStore';

const roleBadgeClass: Record<'owner' | 'editor' | 'viewer', string> = {
  owner: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
};

export function TeamSelector() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const currentTeamId = useTeamStore((s) => s.currentTeamId);
  const setCurrentTeamId = useTeamStore((s) => s.setCurrentTeamId);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const workspaces = user?.workspaces ?? [];
  const currentTeam = workspaces.find((ws) => ws.id === currentTeamId);

  const filtered = search.trim()
    ? workspaces.filter((ws) => ws.name.toLowerCase().includes(search.toLowerCase()))
    : workspaces;

  const createMutation = useMutation({
    mutationFn: (name: string) => createWorkspace({ name }),
    onSuccess: async (ws) => {
      setCreateError(null);
      setNewName('');
      setShowCreate(false);
      try {
        const refreshed = await fetchCurrentUser();
        if (refreshed) {
          useAuthStore.setState({ user: refreshed });
        }
      } catch {
        // User data will refresh on next page load
      }
      setCurrentTeamId(ws.id);
      setOpen(false);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = newName.trim();
    if (!trimmed || createMutation.isPending) return;
    setCreateError(null);
    createMutation.mutate(trimmed);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (showCreate || createMutation.isPending)) {
      return;
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      setShowCreate(false);
      setNewName('');
      setCreateError(null);
      setSearch('');
    }
  };

  if (!workspaces.length) {
    return <div className="px-4 py-3 text-sm text-slate-400">{t.noTeamsAvailable}</div>;
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-indigo-100 text-xs font-bold text-indigo-700">
            {(currentTeam?.name ?? 'T')[0].toUpperCase()}
          </div>
          <span className="flex-1 truncate">{currentTeam?.name ?? t.selectTeam}</span>
          <CaretDown size={14} weight="bold" className="flex-shrink-0 text-slate-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (showCreate || createMutation.isPending) {
              e.preventDefault();
            }
          }}
          className="z-50 w-[260px] rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {/* Search */}
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <MagnifyingGlass
                size={14}
                weight="bold"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchTeams}
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Team list */}
          <div className="max-h-[240px] overflow-y-auto p-1.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t.allTeams}
            </div>
            {filtered.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  setCurrentTeamId(ws.id);
                  setOpen(false);
                  setSearch('');
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                  {ws.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{ws.name}</div>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none ${roleBadgeClass[ws.role]}`}
                >
                  {ws.role}
                </span>
                {ws.id === currentTeamId && (
                  <Check size={14} weight="bold" className="flex-shrink-0 text-indigo-600" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-slate-400">
                {t.noTeamsAvailable}
              </div>
            )}
          </div>

          {/* Create team */}
          <div className="border-t border-slate-100 p-2">
            {showCreate ? (
              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t.createTeamPlaceholder}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  disabled={createMutation.isPending}
                />
                {createError && <div className="text-[11px] text-rose-500">{createError}</div>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newName.trim() || createMutation.isPending}
                    className="flex-1 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
                  >
                    {createMutation.isPending ? '…' : t.create}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                      setCreateError(null);
                    }}
                    disabled={createMutation.isPending}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
              >
                <Plus size={16} weight="bold" />
                {t.createTeam}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
