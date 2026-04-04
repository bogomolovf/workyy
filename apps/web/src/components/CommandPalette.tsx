'use client';

import {
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlass,
  Plus,
  House,
  User,
  Desktop,
  Copy,
  Star,
  Trash,
  FileCsv,
  FileImage,
  Code,
  TextT,
  Note,
  Diamond,
  Flask,
  Kanban,
} from '@phosphor-icons/react';
import { Command } from 'cmdk';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { BoardMenuContext } from '../features/boardMenu/boardMenuActions';
import { useTranslation } from '../hooks/useTranslation';
import { useTrackerSettingsStore } from '../state/trackerSettingsStore';

type PaletteCommand = {
  id: string;
  label: string;
  group: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  menuContext: BoardMenuContext | null;
  onAddNode?: (type: string) => void;
};

export function CommandPalette({ open, onClose, menuContext, onAddNode }: CommandPaletteProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const starredTrackerIds = useTrackerSettingsStore((s) => s.starredTrackerIds);
  const lastVisitedTrackers = useTrackerSettingsStore((s) => s.lastVisitedAtByTrackerId);

  const commands = useMemo<PaletteCommand[]>(() => {
    const bm = t.boardMenu ?? {};
    const tt = t.tracker ?? {};
    const cmds: PaletteCommand[] = [];

    // Tracker navigation commands (always available)
    const recentTrackerIds = Object.entries(lastVisitedTrackers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    if (recentTrackerIds.length > 0) {
      for (const id of recentTrackerIds) {
        cmds.push({
          id: `tracker-${id}`,
          label: `${tt.openTracker ?? 'Open tracker'}: ${id.slice(0, 8)}…`,
          group: tt.trackers ?? 'Trackers',
          icon: <Kanban size={16} />,
          action: () => {
            window.location.href = `/tracker/${id}`;
          },
        });
      }
    }

    cmds.push({
      id: 'home-trackers',
      label: tt.createTrackerCmd ?? 'Create tracker',
      group: tt.trackers ?? 'Trackers',
      icon: <Plus size={16} />,
      action: () => {
        window.location.href = '/';
      },
    });

    if (!menuContext) return cmds;
    const ctx = menuContext;

    cmds.push(
      {
        id: 'undo',
        label: bm.undo ?? 'Undo',
        group: bm.edit ?? 'Edit',
        icon: <ArrowCounterClockwise size={16} />,
        shortcut: '⌘Z',
        action: () => ctx.undo(),
        disabled: !ctx.canUndo,
      },
      {
        id: 'redo',
        label: bm.redo ?? 'Redo',
        group: bm.edit ?? 'Edit',
        icon: <ArrowClockwise size={16} />,
        shortcut: '⌘⇧Z',
        action: () => ctx.redo(),
        disabled: !ctx.canRedo,
      },
      {
        id: 'find',
        label: bm.find ?? 'Find',
        group: bm.edit ?? 'Edit',
        icon: <MagnifyingGlass size={16} />,
        shortcut: '⌘F',
        action: () => ctx.onOpenFind?.(),
      },
      {
        id: 'newBoard',
        label: bm.newBoard ?? '+ New board',
        group: bm.board ?? 'Board',
        icon: <Plus size={16} />,
        action: () => ctx.routerPush('/'),
      },
      {
        id: 'duplicate',
        label: bm.duplicate ?? 'Duplicate',
        group: bm.board ?? 'Board',
        icon: <Copy size={16} />,
        action: () => {
          import('../features/boardMenu/boardMenuActions').then((m) => m.runDuplicate(ctx));
        },
      },
      {
        id: 'starBoard',
        label: bm.starBoard ?? 'Star this board',
        group: bm.board ?? 'Board',
        icon: <Star size={16} />,
        action: () => {
          import('../features/boardMenu/boardMenuActions').then((m) => m.runStarBoard(ctx));
        },
      },
      {
        id: 'exportCsv',
        label: bm.exportSpreadsheet ?? 'Export to spreadsheet',
        group: bm.board ?? 'Board',
        icon: <FileCsv size={16} />,
        action: () => {
          import('../features/boardMenu/boardMenuActions').then((m) => m.runExportSpreadsheet(ctx));
        },
      },
      {
        id: 'exportImage',
        label: bm.exportImage ?? 'Export as image',
        group: bm.board ?? 'Board',
        icon: <FileImage size={16} />,
        action: () => {
          import('../features/boardMenu/boardMenuActions').then((m) => m.runExportImage(ctx));
        },
      },
      {
        id: 'deleteBoard',
        label: bm.delete ?? 'Delete',
        group: bm.board ?? 'Board',
        icon: <Trash size={16} />,
        action: () => ctx.onDeleteBoard(ctx.boardId),
      },
      {
        id: 'fullscreen',
        label: bm.fullscreen ?? 'Fullscreen',
        group: bm.view ?? 'View',
        icon: <Desktop size={16} />,
        action: () => {
          import('../features/boardMenu/boardMenuActions').then((m) => m.runFullscreen(ctx));
        },
      },
      {
        id: 'home',
        label: t.home ?? 'Home',
        group: t.navigate ?? 'Navigate',
        icon: <House size={16} />,
        action: () => ctx.routerPush('/'),
      },
      {
        id: 'profile',
        label: bm.profileSettings ?? 'Profile settings',
        group: t.navigate ?? 'Navigate',
        icon: <User size={16} />,
        action: () => ctx.routerPush('/user-profile'),
      },
    );

    if (onAddNode) {
      cmds.push(
        {
          id: 'addSql',
          label: t.addSqlNode ?? 'Add SQL node',
          group: t.create ?? 'Create',
          icon: <Code size={16} />,
          action: () => onAddNode('sql'),
        },
        {
          id: 'addPython',
          label: t.addPythonNode ?? 'Add Python node',
          group: t.create ?? 'Create',
          icon: <Flask size={16} />,
          action: () => onAddNode('python'),
        },
        {
          id: 'addText',
          label: t.addTextNode ?? 'Add Text node',
          group: t.create ?? 'Create',
          icon: <TextT size={16} />,
          action: () => onAddNode('text'),
        },
        {
          id: 'addSticky',
          label: t.addStickyNode ?? 'Add Sticky note',
          group: t.create ?? 'Create',
          icon: <Note size={16} />,
          action: () => onAddNode('sticky'),
        },
        {
          id: 'addShape',
          label: t.addShapeNode ?? 'Add Shape',
          group: t.create ?? 'Create',
          icon: <Diamond size={16} />,
          action: () => onAddNode('shape'),
        },
      );
    }

    return cmds;
  }, [menuContext, t, onAddNode, lastVisitedTrackers, starredTrackerIds]);

  const handleSelect = useCallback(
    (cmdId: string) => {
      const cmd = commands.find((c) => c.id === cmdId);
      if (cmd && !cmd.disabled) {
        onClose();
        cmd.action();
      }
    },
    [commands, onClose],
  );

  if (!open) return null;

  const groups = [...new Set(commands.map((c) => c.group))];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[20vh] bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" shouldFilter>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4">
            <MagnifyingGlass size={16} className="text-slate-400" />
            <Command.Input
              ref={inputRef}
              placeholder={t.boardMenu?.commandsPlaceholder ?? 'Type a command…'}
              className="h-11 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-xs text-slate-400">
              {t.boardMenu?.commandsEmpty ?? 'No results'}
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-400"
              >
                {commands
                  .filter((c) => c.group === group)
                  .map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.label}
                      disabled={cmd.disabled}
                      onSelect={() => handleSelect(cmd.id)}
                      className="flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-900 aria-disabled:opacity-40"
                    >
                      {cmd.icon && <span className="text-slate-400">{cmd.icon}</span>}
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
