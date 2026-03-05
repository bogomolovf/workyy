import { describe, it, expect } from 'vitest';
import {
  getBoardMenuSections,
  MENU_SECTION_IDS,
  MENU_ACTION_IDS,
  isMenuItemAction,
  isMenuItemSubmenu,
  isMenuItemToggle,
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
  });

  it('type guards work correctly', () => {
    const board = sections.find((s) => s.id === 'board')!;
    const exportItem = board.children.find((c) => c.label === 'Export')!;
    const deleteItem = board.children.find((c) => c.label === 'Delete')!;
    const lockItem = board.children.find((c) => c.label === 'Lock default view')!;
    expect(isMenuItemSubmenu(exportItem)).toBe(true);
    expect(isMenuItemAction(deleteItem)).toBe(true);
    expect(isMenuItemToggle(lockItem)).toBe(true);
  });
});
