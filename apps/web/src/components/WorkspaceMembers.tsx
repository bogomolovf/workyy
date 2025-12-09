'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Trash, User } from '@phosphor-icons/react';
import {
  fetchWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMember,
} from '../lib/api';
import { useAuthStore } from '../state/authStore';

type WorkspaceMembersProps = {
  workspaceId: string;
  onClose?: () => void;
};

const roleLabels: Record<'owner' | 'editor' | 'viewer', string> = {
  owner: 'Владелец',
  editor: 'Редактор',
  viewer: 'Наблюдатель',
};

const roleColors: Record<'owner' | 'editor' | 'viewer', string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-200',
  editor: 'bg-blue-100 text-blue-700 border-blue-200',
  viewer: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function WorkspaceMembers({ workspaceId, onClose }: WorkspaceMembersProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');
  const [error, setError] = useState<string | null>(null);

  const {
    data: members,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => fetchWorkspaceMembers(workspaceId),
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: { email: string; role: 'owner' | 'editor' | 'viewer' }) =>
      addWorkspaceMember(workspaceId, payload),
    onSuccess: () => {
      setEmail('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось добавить участника');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: string) => removeWorkspaceMember(workspaceId, memberUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось удалить участника');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberUserId,
      role,
    }: {
      memberUserId: string;
      role: 'owner' | 'editor' | 'viewer';
    }) => updateWorkspaceMemberRole(workspaceId, memberUserId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось обновить роль');
    },
  });

  const handleAddMember = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) {
        setError('Введите email');
        return;
      }
      addMemberMutation.mutate({ email: email.trim(), role: selectedRole });
    },
    [email, selectedRole, addMemberMutation],
  );

  const handleRemoveMember = useCallback(
    (memberUserId: string) => {
      if (confirm('Вы уверены, что хотите удалить этого участника из workspace?')) {
        removeMemberMutation.mutate(memberUserId);
      }
    },
    [removeMemberMutation],
  );

  const handleRoleChange = useCallback(
    (memberUserId: string, newRole: 'owner' | 'editor' | 'viewer') => {
      updateRoleMutation.mutate({ memberUserId, role: newRole });
    },
    [updateRoleMutation],
  );

  // Check if current user is owner or editor (can manage members)
  const currentUserMember = members?.find((m) => m.userId === user?.id);
  const canManageMembers =
    currentUserMember?.role === 'owner' || currentUserMember?.role === 'editor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">Участники workspace</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
          {/* Add member form */}
          {canManageMembers && (
            <form onSubmit={handleAddMember} className="mb-6 rounded-lg border border-slate-200 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Добавить участника</h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  disabled={addMemberMutation.isPending}
                />
                <select
                  value={selectedRole}
                  onChange={(e) =>
                    setSelectedRole(e.target.value as 'owner' | 'editor' | 'viewer')
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  disabled={addMemberMutation.isPending}
                >
                  <option value="viewer">Наблюдатель</option>
                  <option value="editor">Редактор</option>
                  <option value="owner">Владелец</option>
                </select>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !email.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
                >
                  <UserPlus size={18} />
                  {addMemberMutation.isPending ? 'Добавляем…' : 'Добавить'}
                </button>
              </div>
              {error && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </div>
              )}
            </form>
          )}

          {/* Members list */}
          {isLoading && (
            <div className="py-8 text-center text-sm text-slate-500">Загрузка участников…</div>
          )}

          {isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              Не удалось загрузить список участников
            </div>
          )}

          {members && members.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              В workspace пока нет участников
            </div>
          )}

          {members && members.length > 0 && (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <User size={20} weight="bold" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {member.name || member.email}
                      </div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role badge/selector */}
                    {currentUserMember?.role === 'owner' && member.userId !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(
                            member.userId,
                            e.target.value as 'owner' | 'editor' | 'viewer',
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        disabled={updateRoleMutation.isPending}
                      >
                        <option value="viewer">Наблюдатель</option>
                        <option value="editor">Редактор</option>
                        <option value="owner">Владелец</option>
                      </select>
                    ) : (
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${roleColors[member.role]}`}
                      >
                        {roleLabels[member.role]}
                      </span>
                    )}

                    {/* Remove button */}
                    {canManageMembers && member.userId !== user?.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={removeMemberMutation.isPending}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed"
                        title="Удалить участника"
                      >
                        <Trash size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3">
          <p className="text-xs text-slate-500">
            Участники workspace могут видеть и работать с досками в этом workspace. Для
            тестирования коллаборации добавьте другого пользователя и откройте одну и ту же доску
            в разных браузерах.
          </p>
        </div>
      </div>
    </div>
  );
}

