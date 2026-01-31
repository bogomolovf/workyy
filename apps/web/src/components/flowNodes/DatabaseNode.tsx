'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { DatabaseNodePayload } from '../../lib/databaseNodeTypes';
import { DATABASE_TYPE_LABELS } from '../../lib/databaseNodeTypes';
import { DatabaseConnectionModal } from '../DatabaseConnectionModal';

type DatabaseNodeData = {
  nodeId: string;
  workspaceId: string;
  onUpdatePayload: (nodeId: string, payload: Record<string, unknown>) => void;
  payload?: Record<string, unknown>;
};

function StatusBadge({ status }: { status: 'idle' | 'connected' | 'error' }) {
  const { label, className } = (() => {
    switch (status) {
      case 'connected':
        return {
          label: 'Connected',
          className: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        };
      case 'error':
        return {
          label: 'Error',
          className: 'bg-rose-50 text-rose-600 border border-rose-200',
        };
      default:
        return {
          label: 'Idle',
          className: 'bg-slate-100 text-slate-500 border border-slate-200',
        };
    }
  })();

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${className}`}>{label}</span>
  );
}

export function DatabaseNode({ data, selected }: NodeProps<DatabaseNodeData>) {
  const payload =
    (data.payload as DatabaseNodePayload | undefined) ??
    ({
      connectionName: 'New Database',
      dbType: 'postgresql',
      host: '',
      port: 5432,
      database: '',
      username: '',
      ssl: false,
      status: 'idle',
    } satisfies DatabaseNodePayload);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        className="relative rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 shadow-lg transition-all"
        style={{ width: 280 }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!border-white !border-2"
          style={{
            width: 16,
            height: 16,
            borderRadius: '9999px',
            background: '#6366f1',
            right: -8,
            top: '50%',
            transform: 'translate(50%, -50%)',
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
        />
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg
                className="h-6 w-6 text-slate-400 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {/* Stacked cylinders icon */}
                <ellipse cx="12" cy="8" rx="6" ry="2" opacity="0.8" />
                <ellipse cx="10" cy="12" rx="5" ry="2" opacity="0.6" />
                <ellipse cx="14" cy="16" rx="4" ry="2" opacity="0.4" />
                <line x1="6" y1="8" x2="6" y2="14" strokeLinecap="round" />
                <line x1="18" y1="8" x2="18" y2="14" strokeLinecap="round" />
                <line x1="5" y1="12" x2="5" y2="18" strokeLinecap="round" />
                <line x1="15" y1="12" x2="15" y2="18" strokeLinecap="round" />
                <line x1="10" y1="16" x2="10" y2="20" strokeLinecap="round" />
                <line x1="18" y1="16" x2="18" y2="20" strokeLinecap="round" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {payload.connectionName || 'New Database'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {DATABASE_TYPE_LABELS[payload.dbType]}
                  {payload.host && ` • ${payload.host}:${payload.port}`}
                </p>
              </div>
            </div>
            <StatusBadge status={payload.status ?? 'idle'} />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 w-full rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 transition-colors"
          >
            Configure
          </button>
        </div>
      </div>
      <DatabaseConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPayload={payload}
        workspaceId={data.workspaceId}
        onSave={(updatedPayload) => {
          data.onUpdatePayload(data.nodeId, updatedPayload);
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
