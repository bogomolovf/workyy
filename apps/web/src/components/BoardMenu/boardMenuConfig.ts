import type { Icon } from '@phosphor-icons/react';

export type BoardSettingsKey =
  | 'gridVisible'
  | 'showCollaboratorCursors'
  | 'showComments'
  | 'showScrollbars'
  | 'showObjectDimensions'
  | 'showUndoRedoControls'
  | 'alignObjects'
  | 'followAllThreads'
  | 'lockDefaultView'
  | 'snapToGrid'
  | 'invertScroll';

export type MenuItemAction =
  | 'undo'
  | 'redo'
  | 'commands'
  | 'find'
  | 'fullscreen'
  | 'catchUp'
  | 'newBoard'
  | 'duplicate'
  | 'starBoard'
  | 'delete'
  | 'startView'
  | 'history'
  | 'details'
  | 'profileSettings'
  | 'exportPdf'
  | 'exportImage'
  | 'saveAsTemplate'
  | 'exportSpreadsheet'
  | 'downloadBackup'
  | 'embed'
  | 'saveToGoogleDrive'
  | 'gridSizeSmall'
  | 'gridSizeMedium'
  | 'gridSizeLarge'
  | 'scrollAndZoom'
  | 'scrollToPan';

export type MenuItemType = 'action' | 'toggle' | 'submenu' | 'color-picker';

export type MenuItemBase = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: Icon;
  disabled?: boolean;
};

export type MenuItemActionConfig = MenuItemBase & {
  type: 'action';
  action: MenuItemAction;
};

export type MenuItemToggleConfig = MenuItemBase & {
  type: 'toggle';
  toggleKey: BoardSettingsKey;
};

export type MenuItemSubmenuConfig = MenuItemBase & {
  type: 'submenu';
  children: MenuItemConfig[];
};

export type MenuItemColorPickerConfig = MenuItemBase & {
  type: 'color-picker';
  colors: { value: string; label: string }[];
  storeKey: 'backgroundColor';
};

export type MenuItemConfig =
  | MenuItemActionConfig
  | MenuItemToggleConfig
  | MenuItemSubmenuConfig
  | MenuItemColorPickerConfig;

export type MenuSection = {
  id: string;
  label: string;
  icon?: Icon;
  children: MenuItemConfig[];
};

/** Flattened list of all action/toggle ids for tests and keyboard handling */
export const MENU_ACTION_IDS = new Set<string>([
  'undo',
  'redo',
  'commands',
  'find',
  'fullscreen',
  'catchUp',
  'newBoard',
  'duplicate',
  'starBoard',
  'delete',
  'startView',
  'history',
  'details',
  'profileSettings',
  'exportPdf',
  'exportImage',
  'saveAsTemplate',
  'exportSpreadsheet',
  'downloadBackup',
  'embed',
  'saveToGoogleDrive',
  'gridSizeSmall',
  'gridSizeMedium',
  'gridSizeLarge',
  'scrollAndZoom',
  'scrollToPan',
]);

/** Top-level section ids */
export const MENU_SECTION_IDS = ['board', 'edit', 'view', 'preferences'] as const;

/** Config is built in BoardMenu to use icons; this file exports structure only (labels/ids/types). */
export type BoardMenuTranslations = Record<string, string>;

function translateSections(sections: MenuSection[], t: BoardMenuTranslations): MenuSection[] {
  return sections.map((section) => ({
    ...section,
    label: t[section.id] ?? section.label,
    children: section.children.map((item) => {
      const base = { ...item, label: t[item.id] ?? item.label };
      if (base.type === 'submenu' && base.children) {
        return {
          ...base,
          children: base.children.map((child) => ({
            ...child,
            label: t[child.id] ?? child.label,
          })),
        };
      }
      return base;
    }),
  }));
}

export function getBoardMenuSections(
  getIcon: (name: string) => Icon | undefined,
  t?: BoardMenuTranslations,
): MenuSection[] {
  const rawSections: Omit<MenuSection, 'icon'>[] = [
    {
      id: 'board',
      label: 'Board',
      children: [
        { id: 'catchUp', label: 'Catch up', type: 'action', action: 'catchUp' },
        { id: 'newBoard', label: '+ New board', type: 'action', action: 'newBoard' },
        { id: 'duplicate', label: 'Duplicate', type: 'action', action: 'duplicate' },
        {
          id: 'export',
          label: 'Export',
          type: 'submenu',
          children: [
            { id: 'exportPdf', label: 'Save as PDF', type: 'action', action: 'exportPdf' },
            { id: 'exportImage', label: 'Export as image', type: 'action', action: 'exportImage' },
            {
              id: 'saveAsTemplate',
              label: 'Save board as template',
              type: 'action',
              action: 'saveAsTemplate',
            },
            {
              id: 'exportSpreadsheet',
              label: 'Export to spreadsheet (CSV)',
              type: 'action',
              action: 'exportSpreadsheet',
            },
            {
              id: 'downloadBackup',
              label: 'Download board backup',
              type: 'action',
              action: 'downloadBackup',
            },
            { id: 'embed', label: 'Embed', type: 'action', action: 'embed' },
            {
              id: 'saveToGoogleDrive',
              label: 'Save to Google Drive',
              type: 'action',
              action: 'saveToGoogleDrive',
            },
          ],
        },
        {
          id: 'moveTo',
          label: 'Move to',
          type: 'submenu',
          children: [], // stub submenu
        },
        { id: 'starBoard', label: 'Star this board', type: 'action', action: 'starBoard' },
        { id: 'delete', label: 'Delete', type: 'action', action: 'delete' },
        {
          id: 'backgroundColor',
          label: 'Background color',
          type: 'color-picker',
          storeKey: 'backgroundColor',
          colors: [
            { value: '#ffffff', label: 'White' },
            { value: '#f8fafc', label: 'Snow' },
            { value: '#f1f5f9', label: 'Light gray' },
            { value: '#e2e8f0', label: 'Gray' },
            { value: '#fef3c7', label: 'Warm' },
            { value: '#dbeafe', label: 'Sky' },
            { value: '#d1fae5', label: 'Mint' },
            { value: '#1e293b', label: 'Dark' },
          ],
        },
        { id: 'startView', label: 'Start view', type: 'action', action: 'startView' },
        {
          id: 'lockDefaultView',
          label: 'Lock default view',
          type: 'toggle',
          toggleKey: 'lockDefaultView',
        },
        { id: 'history', label: 'History', type: 'action', action: 'history' },
        { id: 'details', label: 'Details', type: 'action', action: 'details' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      children: [
        {
          id: 'undo',
          label: 'Undo',
          shortcut: '⌘Z',
          type: 'action',
          action: 'undo',
        },
        {
          id: 'redo',
          label: 'Redo',
          shortcut: '⌘⇧Z',
          type: 'action',
          action: 'redo',
        },
        {
          id: 'commands',
          label: 'Commands',
          shortcut: '⌘K',
          type: 'action',
          action: 'commands',
        },
        {
          id: 'find',
          label: 'Find',
          shortcut: '⌘F',
          type: 'action',
          action: 'find',
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      children: [
        {
          id: 'grid',
          label: 'Grid',
          type: 'submenu',
          children: [
            { id: 'gridVisible', label: 'Show grid', type: 'toggle', toggleKey: 'gridVisible' },
            { id: 'snapToGrid', label: 'Snap to grid', type: 'toggle', toggleKey: 'snapToGrid' },
            { id: 'gridSizeSmall', label: 'Small', type: 'action', action: 'gridSizeSmall' },
            { id: 'gridSizeMedium', label: 'Medium', type: 'action', action: 'gridSizeMedium' },
            { id: 'gridSizeLarge', label: 'Large', type: 'action', action: 'gridSizeLarge' },
          ],
        },
        {
          id: 'showCollaboratorCursors',
          label: "Show collaborators' cursors",
          type: 'toggle',
          toggleKey: 'showCollaboratorCursors',
        },
        {
          id: 'showComments',
          label: 'Comments on board',
          type: 'toggle',
          toggleKey: 'showComments',
        },
        {
          id: 'showScrollbars',
          label: 'Scroll bars',
          type: 'toggle',
          toggleKey: 'showScrollbars',
        },
        {
          id: 'showObjectDimensions',
          label: 'Object dimensions',
          type: 'toggle',
          toggleKey: 'showObjectDimensions',
        },
        {
          id: 'showUndoRedoControls',
          label: 'Undo/Redo controls',
          type: 'toggle',
          toggleKey: 'showUndoRedoControls',
        },
        {
          id: 'fullscreen',
          label: 'Enter full screen',
          type: 'action',
          action: 'fullscreen',
        },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      children: [
        {
          id: 'mouseOrTrackpad',
          label: 'Mouse or trackpad',
          type: 'submenu',
          children: [
            {
              id: 'invertScroll',
              label: 'Invert scroll direction',
              type: 'toggle',
              toggleKey: 'invertScroll',
            },
            {
              id: 'scrollAndZoom',
              label: 'Scroll and zoom',
              type: 'action',
              action: 'scrollAndZoom',
            },
            { id: 'scrollToPan', label: 'Scroll to pan', type: 'action', action: 'scrollToPan' },
          ],
        },
        {
          id: 'alignObjects',
          label: 'Align objects',
          type: 'toggle',
          toggleKey: 'alignObjects',
        },
        {
          id: 'followAllThreads',
          label: 'Follow all threads',
          type: 'toggle',
          toggleKey: 'followAllThreads',
        },
        {
          id: 'profileSettings',
          label: 'Profile settings',
          type: 'action',
          action: 'profileSettings',
        },
      ],
    },
  ];

  let sections: MenuSection[] = rawSections.map((s) => ({
    ...s,
    icon: getIcon(s.id),
  }));

  if (t) {
    sections = translateSections(sections, t);
  }
  return sections;
}

export function isMenuItemSubmenu(item: MenuItemConfig): item is MenuItemSubmenuConfig {
  return item.type === 'submenu';
}

export function isMenuItemToggle(item: MenuItemConfig): item is MenuItemToggleConfig {
  return item.type === 'toggle';
}

export function isMenuItemAction(item: MenuItemConfig): item is MenuItemActionConfig {
  return item.type === 'action';
}

export function isMenuItemColorPicker(item: MenuItemConfig): item is MenuItemColorPickerConfig {
  return item.type === 'color-picker';
}
