'use client';

import { CaretRight, Check, Eye, Gear, Layout, PencilSimple } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getActionState,
  runCatchUp,
  runCommands,
  runDelete,
  runDetails,
  runDownloadBackup,
  runDuplicate,
  runEmbed,
  runExportImage,
  runExportPdf,
  runExportSpreadsheet,
  runFind,
  runFullscreen,
  runGridSizeLarge,
  runGridSizeMedium,
  runGridSizeSmall,
  runHistory,
  runScrollAndZoom,
  runScrollToPan,
  runMoveTo,
  runNewBoard,
  runProfileSettings,
  runRedo,
  runSaveAsTemplate,
  runSaveToGoogleDrive,
  runStarBoard,
  runStartView,
  runUndo,
  type BoardMenuContext,
} from '../../features/boardMenu/boardMenuActions';
import { useTranslation } from '../../hooks/useTranslation';
import { useBoardSettingsStore } from '../../state/boardSettingsStore';
import { useToastStore } from '../../state/toastStore';
import {
  getBoardMenuSections,
  isMenuItemAction,
  isMenuItemColorPicker,
  isMenuItemSubmenu,
  isMenuItemToggle,
  type BoardSettingsKey,
  type MenuItemConfig,
} from './boardMenuConfig';

const SECTION_ICONS: Record<string, typeof Layout> = {
  board: Layout,
  edit: PencilSimple,
  view: Eye,
  preferences: Gear,
};

function getIcon(name: string): typeof Layout | undefined {
  return SECTION_ICONS[name];
}

export type BoardMenuProps = {
  trigger: React.ReactNode;
  menuContext: Omit<BoardMenuContext, 'onCloseMenu'>;
};

const ACTION_RUNNERS: Record<string, (ctx: BoardMenuContext) => void | Promise<void>> = {
  catchUp: runCatchUp,
  newBoard: (ctx) => runNewBoard(ctx),
  duplicate: (ctx) => runDuplicate(ctx),
  exportPdf: runExportPdf,
  exportImage: runExportImage,
  saveAsTemplate: runSaveAsTemplate,
  exportSpreadsheet: runExportSpreadsheet,
  downloadBackup: runDownloadBackup,
  embed: runEmbed,
  saveToGoogleDrive: runSaveToGoogleDrive,
  moveTo: runMoveTo,
  starBoard: runStarBoard,
  delete: runDelete,
  startView: runStartView,
  history: runHistory,
  details: runDetails,
  undo: runUndo,
  redo: runRedo,
  commands: runCommands,
  find: runFind,
  fullscreen: runFullscreen,
  profileSettings: runProfileSettings,
  gridSizeSmall: runGridSizeSmall,
  gridSizeMedium: runGridSizeMedium,
  gridSizeLarge: runGridSizeLarge,
  scrollAndZoom: runScrollAndZoom,
  scrollToPan: runScrollToPan,
};

export function BoardMenu({ trigger, menuContext }: BoardMenuProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const sections = getBoardMenuSections(getIcon, t.boardMenu);
  const toggleValues = useBoardSettingsStore(
    useShallow((s) => ({
      gridVisible: s.gridVisible,
      showCollaboratorCursors: s.showCollaboratorCursors,
      showComments: s.showComments,
      showScrollbars: s.showScrollbars,
      showObjectDimensions: s.showObjectDimensions,
      showUndoRedoControls: s.showUndoRedoControls,
      alignObjects: s.alignObjects,
      followAllThreads: s.followAllThreads,
      lockDefaultView: s.lockDefaultView,
      snapToGrid: s.snapToGrid,
      invertScroll: s.invertScroll,
    })),
  );
  const isStarred = useBoardSettingsStore((s) => s.isStarred(menuContext.boardId));
  const currentBgColor = useBoardSettingsStore((s) => s.backgroundColor);
  const currentGridSize = useBoardSettingsStore((s) => s.gridSize);
  const currentScrollBehavior = useBoardSettingsStore((s) => s.scrollBehavior);

  const fullContext = useMemo<BoardMenuContext>(
    () => ({ ...menuContext, onCloseMenu: () => setOpen(false) }),
    [menuContext],
  );

  const setToggle = useCallback((key: BoardSettingsKey, value: boolean) => {
    const store = useBoardSettingsStore.getState();
    const setterMap: Record<BoardSettingsKey, (v: boolean) => void> = {
      gridVisible: store.setGridVisible,
      showCollaboratorCursors: store.setShowCollaboratorCursors,
      showComments: store.setShowComments,
      showScrollbars: store.setShowScrollbars,
      showObjectDimensions: store.setShowObjectDimensions,
      showUndoRedoControls: store.setShowUndoRedoControls,
      alignObjects: store.setAlignObjects,
      followAllThreads: store.setFollowAllThreads,
      lockDefaultView: store.setLockDefaultView,
      snapToGrid: store.setSnapToGrid,
      invertScroll: store.setInvertScroll,
    };
    setterMap[key]?.(value);
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      const run = ACTION_RUNNERS[action];
      if (run) {
        const result = run(fullContext);
        if (result instanceof Promise) {
          result.catch((err) => {
            useToastStore
              .getState()
              .show(err instanceof Error ? err.message : t.boardMenu.actionFailed, 'error');
          });
        }
      }
    },
    [fullContext, t],
  );

  const itemClassName =
    'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  const subTriggerClassName =
    'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100 data-[disabled]:pointer-events-none [&>svg]:ml-auto';
  const contentClassName =
    'min-w-[12rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg text-slate-900';
  const checkboxItemClassName =
    'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100 data-[disabled]:pointer-events-none';

  function renderItem(item: MenuItemConfig, sectionId: string) {
    if (isMenuItemAction(item)) {
      const actionState = getActionState(item.action, fullContext);
      const disabled = actionState.disabled;
      const title = actionState.disabledReason ?? undefined;
      let label = item.label;
      if (item.action === 'starBoard') {
        label = isStarred ? t.boardMenu.unstarBoard : t.boardMenu.starBoard;
      }
      const radioMap: Record<string, string> = {
        gridSizeSmall: 'small',
        gridSizeMedium: 'medium',
        gridSizeLarge: 'large',
        scrollAndZoom: 'scrollAndZoom',
        scrollToPan: 'scrollToPan',
      };
      const radioCurrentMap: Record<string, string> = {
        gridSizeSmall: currentGridSize,
        gridSizeMedium: currentGridSize,
        gridSizeLarge: currentGridSize,
        scrollAndZoom: currentScrollBehavior,
        scrollToPan: currentScrollBehavior,
      };
      const isActiveRadio =
        radioMap[item.action] != null && radioMap[item.action] === radioCurrentMap[item.action];
      return (
        <DropdownMenu.Item
          key={item.id}
          className={itemClassName}
          disabled={disabled}
          title={title}
          onSelect={(e) => {
            e.preventDefault();
            handleAction(item.action);
          }}
          textValue={label}
        >
          {isActiveRadio && <Check size={14} weight="bold" className="text-indigo-600" />}
          <span className="flex-1">{label}</span>
          {item.shortcut && <span className="ml-auto text-slate-500">{item.shortcut}</span>}
        </DropdownMenu.Item>
      );
    }
    if (isMenuItemToggle(item)) {
      const checked = toggleValues[item.toggleKey] ?? false;
      return (
        <DropdownMenu.CheckboxItem
          key={item.id}
          className={checkboxItemClassName}
          checked={checked}
          disabled={item.disabled}
          title={item.disabled ? t.boardMenu.notSupportedYet : undefined}
          onCheckedChange={(value) => {
            if (typeof value === 'boolean') setToggle(item.toggleKey, value);
          }}
          textValue={item.label}
        >
          <DropdownMenu.ItemIndicator className="inline-flex items-center justify-center text-indigo-600">
            <Check size={14} weight="bold" />
          </DropdownMenu.ItemIndicator>
          {item.label}
        </DropdownMenu.CheckboxItem>
      );
    }
    if (isMenuItemColorPicker(item)) {
      return (
        <DropdownMenu.Sub key={item.id}>
          <DropdownMenu.SubTrigger className={subTriggerClassName} textValue={item.label}>
            <span
              className="inline-block h-4 w-4 rounded-full border border-slate-300"
              style={{ backgroundColor: currentBgColor }}
            />
            {item.label}
            <CaretRight size={14} className="ml-auto" />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent className={contentClassName} sideOffset={4} alignOffset={-4}>
              <div className="grid grid-cols-4 gap-1 p-1">
                {item.colors.map((c) => (
                  <DropdownMenu.Item
                    key={c.value}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-indigo-400"
                    title={c.label}
                    onSelect={(e) => {
                      e.preventDefault();
                      useBoardSettingsStore.getState().setBackgroundColor(c.value);
                    }}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full border ${
                        currentBgColor === c.value
                          ? 'border-indigo-500 ring-2 ring-indigo-300'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  </DropdownMenu.Item>
                ))}
              </div>
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      );
    }
    if (isMenuItemSubmenu(item)) {
      const hasChildren = item.children && item.children.length > 0;
      return (
        <DropdownMenu.Sub key={item.id}>
          <DropdownMenu.SubTrigger className={subTriggerClassName} textValue={item.label}>
            {item.label}
            <CaretRight size={14} className="ml-auto" />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent className={contentClassName} sideOffset={4} alignOffset={-4}>
              {hasChildren ? item.children.map((child) => renderItem(child, sectionId)) : null}
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      );
    }
    return null;
  }

  const sectionTriggerClassName =
    'flex w-full cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-slate-900 outline-none data-[highlighted]:bg-slate-100 data-[state=open]:bg-slate-50 [&>svg:last-child]:ml-auto';

  const content = (
    <DropdownMenu.Content
      className={contentClassName}
      sideOffset={6}
      align="start"
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <DropdownMenu.Sub key={section.id}>
            <DropdownMenu.SubTrigger className={sectionTriggerClassName} textValue={section.label}>
              {SectionIcon && <SectionIcon size={16} />}
              <span className="flex-1">{section.label}</span>
              <CaretRight size={14} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className={contentClassName} sideOffset={4} alignOffset={-4}>
                {section.children.map((item) => renderItem(item, section.id))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        );
      })}
    </DropdownMenu.Content>
  );

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>{content}</DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
