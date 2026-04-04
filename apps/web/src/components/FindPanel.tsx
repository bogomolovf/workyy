'use client';

import { MagnifyingGlass, CaretUp, CaretDown, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useBoardCanvasApiStore } from '../state/boardCanvasApiStore';
import { useExecutionStore } from '../state/executionStore';

export type FindPanelProps = {
  open: boolean;
  onClose: () => void;
};

type FindMatch = {
  nodeId: string;
  label: string;
  type: string;
  position: { x: number; y: number };
};

export function FindPanel({ open, onClose }: FindPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const getNodes = useBoardCanvasApiStore((s) => s.getNodes);
  const setCenter = useBoardCanvasApiStore((s) => s.setCenter);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const matches = useMemo<FindMatch[]>(() => {
    if (!query.trim() || !getNodes) return [];
    const q = query.toLowerCase();
    const nodes = getNodes();
    const entries = useExecutionStore.getState().entries;
    const result: FindMatch[] = [];

    for (const node of nodes) {
      const data = node.data as Record<string, unknown> | undefined;
      const label = (data?.label as string) ?? '';
      const text = (data?.text as string) ?? '';
      const code = entries[node.id]?.code ?? '';
      const payload = data as Record<string, string> | undefined;
      const sql = payload?.sql ?? '';
      const python = payload?.python ?? '';

      const searchable = [label, text, code, sql, python, node.type ?? ''].join(' ').toLowerCase();
      if (searchable.includes(q)) {
        result.push({
          nodeId: node.id,
          label: label || node.type || node.id.slice(0, 8),
          type: node.type ?? 'unknown',
          position: node.position,
        });
      }
    }
    return result;
  }, [query, getNodes]);

  const navigateTo = useCallback(
    (index: number) => {
      const match = matches[index];
      if (match && setCenter) {
        setCenter(match.position.x + 150, match.position.y + 50, { zoom: 1.2, duration: 300 });
      }
    },
    [matches, setCenter],
  );

  const handleNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    navigateTo(next);
  }, [activeIndex, matches.length, navigateTo]);

  const handlePrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prev);
    navigateTo(prev);
  }, [activeIndex, matches.length, navigateTo]);

  useEffect(() => {
    if (matches.length > 0 && activeIndex >= matches.length) {
      setActiveIndex(0);
    }
  }, [matches.length, activeIndex]);

  useEffect(() => {
    if (matches.length > 0 && query.trim()) {
      navigateTo(activeIndex);
    }
  }, [matches, activeIndex, navigateTo, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleNext, handlePrev, onClose],
  );

  if (!open) return null;

  return (
    <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-lg">
      <MagnifyingGlass size={16} className="text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t.boardMenu?.findPlaceholder ?? 'Search nodes…'}
        className="w-52 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      {query && (
        <span className="text-xs text-slate-400">
          {matches.length > 0 ? `${activeIndex + 1}/${matches.length}` : '0'}
        </span>
      )}
      <button
        type="button"
        onClick={handlePrev}
        disabled={matches.length === 0}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
      >
        <CaretUp size={14} />
      </button>
      <button
        type="button"
        onClick={handleNext}
        disabled={matches.length === 0}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
      >
        <CaretDown size={14} />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}
