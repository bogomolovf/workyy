import { create } from 'zustand';

export type ChainInfo = {
  cellIds: string[];
  name: string;
};

export type ChainStoreState = {
  /** frameId -> chain info */
  chains: Record<string, ChainInfo>;

  /** Reverse lookup: cellId -> frameId */
  cellToFrame: Record<string, string>;

  initChains: (chains: Record<string, ChainInfo>) => void;

  registerFrame: (frameId: string, name: string, cellIds?: string[]) => void;

  removeFrame: (frameId: string) => void;

  addCellToFrame: (frameId: string, cellId: string, afterIndex?: number) => void;

  removeCellFromFrame: (frameId: string, cellId: string) => void;

  reorderCells: (frameId: string, cellIds: string[]) => void;

  renameFrame: (frameId: string, name: string) => void;

  getFrameForCell: (cellId: string) => string | undefined;

  getCellOrder: (frameId: string) => string[];
};

export const useChainStore = create<ChainStoreState>((set, get) => ({
  chains: {},
  cellToFrame: {},

  initChains: (chains) => {
    const cellToFrame: Record<string, string> = {};
    for (const [frameId, info] of Object.entries(chains)) {
      for (const cellId of info.cellIds) {
        cellToFrame[cellId] = frameId;
      }
    }
    set({ chains, cellToFrame });
  },

  registerFrame: (frameId, name, cellIds = []) => {
    const { chains, cellToFrame } = get();
    const nextCellToFrame = { ...cellToFrame };
    for (const cid of cellIds) {
      nextCellToFrame[cid] = frameId;
    }
    set({
      chains: {
        ...chains,
        [frameId]: { cellIds: [...cellIds], name },
      },
      cellToFrame: nextCellToFrame,
    });
  },

  removeFrame: (frameId) => {
    const { chains, cellToFrame } = get();
    const chain = chains[frameId];
    if (!chain) return;
    const nextChains = { ...chains };
    delete nextChains[frameId];
    const nextCellToFrame = { ...cellToFrame };
    for (const cid of chain.cellIds) {
      delete nextCellToFrame[cid];
    }
    set({ chains: nextChains, cellToFrame: nextCellToFrame });
  },

  addCellToFrame: (frameId, cellId, afterIndex) => {
    const { chains, cellToFrame } = get();
    const chain = chains[frameId];
    if (!chain) return;

    const nextCellIds = [...chain.cellIds];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : nextCellIds.length;
    nextCellIds.splice(insertAt, 0, cellId);

    set({
      chains: {
        ...chains,
        [frameId]: { ...chain, cellIds: nextCellIds },
      },
      cellToFrame: { ...cellToFrame, [cellId]: frameId },
    });
  },

  removeCellFromFrame: (frameId, cellId) => {
    const { chains, cellToFrame } = get();
    const chain = chains[frameId];
    if (!chain) return;

    const nextCellIds = chain.cellIds.filter((id) => id !== cellId);
    const nextCellToFrame = { ...cellToFrame };
    delete nextCellToFrame[cellId];

    set({
      chains: {
        ...chains,
        [frameId]: { ...chain, cellIds: nextCellIds },
      },
      cellToFrame: nextCellToFrame,
    });
  },

  reorderCells: (frameId, cellIds) => {
    const { chains } = get();
    const chain = chains[frameId];
    if (!chain) return;
    set({
      chains: {
        ...chains,
        [frameId]: { ...chain, cellIds },
      },
    });
  },

  renameFrame: (frameId, name) => {
    const { chains } = get();
    const chain = chains[frameId];
    if (!chain) return;
    set({
      chains: {
        ...chains,
        [frameId]: { ...chain, name },
      },
    });
  },

  getFrameForCell: (cellId) => {
    return get().cellToFrame[cellId];
  },

  getCellOrder: (frameId) => {
    return get().chains[frameId]?.cellIds ?? [];
  },
}));
