import type { NodeStatus } from '../../state/executionStore';

export const statusColors: Record<NodeStatus, string> = {
  idle: 'border-slate-200',
  running: 'border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.18)]',
  success: 'border-emerald-300 shadow-[0_0_14px_rgba(34,197,94,0.18)]',
  error: 'border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.2)]',
};

export function getNodeColor(type: string) {
  switch (type) {
    case 'sql':
      return '#3b82f6';
    case 'python':
      return '#22c55e';
    case 'plot':
      return '#a855f7';
    default:
      return '#f97316';
  }
}

export function createEdgeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StatusBadge({ status }: { status: NodeStatus }) {
  const text =
    status === 'idle'
      ? 'IDLE'
      : status === 'running'
        ? 'RUNNING'
        : status === 'success'
          ? 'SUCCESS'
          : 'ERROR';
  const tone =
    status === 'running'
      ? 'bg-amber-100 text-amber-600 border border-amber-200'
      : status === 'success'
        ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
        : status === 'error'
          ? 'bg-rose-100 text-rose-600 border border-rose-200'
          : 'bg-slate-200 text-slate-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{text}</span>
  );
}

export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="relative mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
      {onDismiss && (
        <button
          type="button"
          className="absolute right-2 top-1 text-rose-400 transition hover:text-rose-600"
          aria-label="Hide error"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
      {message}
    </div>
  );
}

export function StdoutBlock({
  title,
  content,
  tone,
  onDismiss,
}: {
  title: string;
  content: string;
  tone: 'stdout' | 'stderr' | 'warning';
  onDismiss?: () => void;
}) {
  const styles =
    tone === 'stderr'
      ? 'border border-rose-200 bg-rose-50 text-rose-600'
      : tone === 'warning'
        ? 'border border-amber-200 bg-amber-50 text-amber-700'
        : 'border border-slate-200 bg-slate-100 text-slate-600';
  return (
    <div className={`relative rounded-lg px-4 py-2 text-xs ${styles}`}>
      {onDismiss && (
        <button
          type="button"
          className="absolute right-2 top-1 text-slate-400 transition hover:text-slate-600"
          aria-label="Hide output"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
      <pre className="max-h-40 whitespace-pre-wrap break-words">{content}</pre>
    </div>
  );
}
