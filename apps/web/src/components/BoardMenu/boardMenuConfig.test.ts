import { describe, it, expect } from 'vitest';
import {
  getBoardMenuSections,
  MENU_SECTION_IDS,
  MENU_ACTION_IDS,
  isMenuItemAction,
  isMenuItemSubmenu,
  isMenuItemToggle,
  isMenuItemColorPicker,
} from './boardMenuConfig';

describe('boardMenuConfig', () => {
  const getIcon = () => undefined;
  const sections = getBoardMenuSections(getIcon);

  it('returns four top-level sections (Board, Edit, View, Preferences)', () => {
    expect(sections).toHaveLength(4);
    expect(sections.map((s) => s.id)).toEqual([...MENU_SECTION_IDS]);
    expect(sections.map((s) => s.label)).toEqual(['Board', 'Edit', 'View', 'Preferences']);
  });

  it('Board section contains Catch up, Delete, Export submenu, Lock default view', () => {
    const board = sections.find((s) => s.id === 'board');
    expect(board).toBeDefined();
    const labels = board!.children.map((c) => c.label);
    expect(labels).toContain('Catch up');
    expect(labels).toContain('Delete');
    expect(labels).toContain('Star this board');
    const exportItem = board!.children.find((c) => c.label === 'Export');
    expect(exportItem).toBeDefined();
    expect(exportItem!.type).toBe('submenu');
    if (exportItem!.type === 'submenu') {
      expect(exportItem.children.some((ch) => ch.label === 'Save as PDF')).toBe(true);
    }
    const lockItem = board!.children.find((c) => c.label === 'Lock default view');
    expect(lockItem).toBeDefined();
    expect(isMenuItemToggle(lockItem!)).toBe(true);
  });

  it('Lock default view is enabled (not disabled)', () => {
    const board = sections.find((s) => s.id === 'board')!;
    const lockItem = board.children.find((c) => c.id === 'lockDefaultView');
    expect(lockItem).toBeDefined();
    expect(lockItem!.disabled).toBeUndefined();
  });

  it('Background color is a color-picker with presets', () => {
    const board = sections.find((s) => s.id === 'board')!;
    const bgItem = board.children.find((c) => c.id === 'backgroundColor');
    expect(bgItem).toBeDefined();
    expect(isMenuItemColorPicker(bgItem!)).toBe(true);
    if (bgItem!.type === 'color-picker') {
      expect(bgItem.colors.length).toBeGreaterThanOrEqual(6);
      expect(bgItem.colors[0]).toHaveProperty('value');
      expect(bgItem.colors[0]).toHaveProperty('label');
    }
  });

  it('Edit section contains Undo, Redo, Commands, Find with shortcuts', () => {
    const edit = sections.find((s) => s.id === 'edit');
    expect(edit).toBeDefined();
    const undo = edit!.children.find((c) => c.id === 'undo');
    const redo = edit!.children.find((c) => c.id === 'redo');
    expect(undo).toBeDefined();
    expect(redo).toBeDefined();
    expect(isMenuItemAction(undo!)).toBe(true);
    expect(isMenuItemAction(redo!)).toBe(true);
    expect(undo!.shortcut).toBeDefined();
    expect(redo!.shortcut).toBeDefined();
    expect(edit!.children.some((c) => c.id === 'commands')).toBe(true);
    expect(edit!.children.some((c) => c.id === 'find')).toBe(true);
  });

  it('View section contains Grid submenu with children', () => {
    const view = sections.find((s) => s.id === 'view')!;
    const gridItem = view.children.find((c) => c.id === 'grid');
    expect(gridItem).toBeDefined();
    expect(isMenuItemSubmenu(gridItem!)).toBe(true);
    if (gridItem!.type === 'submenu') {
      expect(gridItem.children.length).toBeGreaterThanOrEqual(3);
      const ids = gridItem.children.map((c) => c.id);
      expect(ids).toContain('gridVisible');
      expect(ids).toContain('snapToGrid');
      expect(ids).toContain('gridSizeSmall');
    }
  });

  it("View section contains Show collaborators' cursors toggle and Enter full screen", () => {
    const view = sections.find((s) => s.id === 'view');
    expect(view).toBeDefined();
    const cursorsItem = view!.children.find((c) => c.id === 'showCollaboratorCursors');
    expect(cursorsItem).toBeDefined();
    expect(isMenuItemToggle(cursorsItem!)).toBe(true);
    const fullscreenItem = view!.children.find((c) => c.id === 'fullscreen');
    expect(fullscreenItem).toBeDefined();
    expect(isMenuItemAction(fullscreenItem!)).toBe(true);
  });

  it('Preferences section contains Mouse/trackpad submenu with children', () => {
    const prefs = sections.find((s) => s.id === 'preferences')!;
    const mouseItem = prefs.children.find((c) => c.id === 'mouseOrTrackpad');
    expect(mouseItem).toBeDefined();
    expect(isMenuItemSubmenu(mouseItem!)).toBe(true);
    if (mouseItem!.type === 'submenu') {
      expect(mouseItem.children.length).toBeGreaterThanOrEqual(2);
      const ids = mouseItem.children.map((c) => c.id);
      expect(ids).toContain('invertScroll');
      expect(ids).toContain('scrollAndZoom');
    }
  });

  it('Preferences section contains Align objects toggle and Profile settings', () => {
    const prefs = sections.find((s) => s.id === 'preferences');
    expect(prefs).toBeDefined();
    const alignItem = prefs!.children.find((c) => c.id === 'alignObjects');
    expect(alignItem).toBeDefined();
    expect(isMenuItemToggle(alignItem!)).toBe(true);
    expect(prefs!.children.some((c) => c.id === 'profileSettings')).toBe(true);
  });

  it('MENU_ACTION_IDS includes key actions', () => {
    expect(MENU_ACTION_IDS.has('undo')).toBe(true);
    expect(MENU_ACTION_IDS.has('redo')).toBe(true);
    expect(MENU_ACTION_IDS.has('delete')).toBe(true);
    expect(MENU_ACTION_IDS.has('fullscreen')).toBe(true);
    expect(MENU_ACTION_IDS.has('exportPdf')).toBe(true);
    expect(MENU_ACTION_IDS.has('gridSizeSmall')).toBe(true);
    expect(MENU_ACTION_IDS.has('scrollAndZoom')).toBe(true);
  });

  it('Board section contains History and Details actions', () => {
    const board = sections.find((s) => s.id === 'board')!;
    const historyItem = board.children.find((c) => c.id === 'history');
    const detailsItem = board.children.find((c) => c.id === 'details');
    expect(historyItem).toBeDefined();
    expect(detailsItem).toBeDefined();
    expect(isMenuItemAction(historyItem!)).toBe(true);
    expect(isMenuItemAction(detailsItem!)).toBe(true);
    if (historyItem!.type === 'action') {
      expect(historyItem.action).toBe('history');
    }
    if (detailsItem!.type === 'action') {
      expect(detailsItem.action).toBe('details');
    }
  });

  it('Edit section has Commands (Cmd+K) and Find (Cmd+F)', () => {
    const edit = sections.find((s) => s.id === 'edit')!;
    const commands = edit.children.find((c) => c.id === 'commands');
    const find = edit.children.find((c) => c.id === 'find');
    expect(commands).toBeDefined();
    expect(find).toBeDefined();
    if (commands!.type === 'action') {
      expect(commands.action).toBe('commands');
      expect(commands.shortcut).toContain('K');
    }
    if (find!.type === 'action') {
      expect(find.action).toBe('find');
      expect(find.shortcut).toContain('F');
    }
  });

  it('Preferences section contains Follow all threads toggle', () => {
    const prefs = sections.find((s) => s.id === 'preferences')!;
    const followItem = prefs.children.find((c) => c.id === 'followAllThreads');
    expect(followItem).toBeDefined();
    expect(isMenuItemToggle(followItem!)).toBe(true);
    if (followItem!.type === 'toggle') {
      expect(followItem.toggleKey).toBe('followAllThreads');
    }
  });

  it('MENU_ACTION_IDS includes history, details, commands, find, catchUp', () => {
    expect(MENU_ACTION_IDS.has('history')).toBe(true);
    expect(MENU_ACTION_IDS.has('details')).toBe(true);
    expect(MENU_ACTION_IDS.has('commands')).toBe(true);
    expect(MENU_ACTION_IDS.has('find')).toBe(true);
    expect(MENU_ACTION_IDS.has('catchUp')).toBe(true);
  });

  it('type guards work correctly', () => {
    const board = sections.find((s) => s.id === 'board')!;
    const exportItem = board.children.find((c) => c.label === 'Export')!;
    const deleteItem = board.children.find((c) => c.label === 'Delete')!;
    const lockItem = board.children.find((c) => c.label === 'Lock default view')!;
    const bgItem = board.children.find((c) => c.id === 'backgroundColor')!;
    expect(isMenuItemSubmenu(exportItem)).toBe(true);
    expect(isMenuItemAction(deleteItem)).toBe(true);
    expect(isMenuItemToggle(lockItem)).toBe(true);
    expect(isMenuItemColorPicker(bgItem)).toBe(true);
  });
});
