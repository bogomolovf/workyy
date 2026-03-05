'use client';

import { createPortal } from 'react-dom';
import { useToastStore, type ToastType } from '../state/toastStore';

const typeStyles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  info: 'bg-slate-700 text-white',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  const content = (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`min-w-[200px] max-w-[360px] rounded-lg px-4 py-2 text-left text-sm shadow-lg transition hover:opacity-90 ${typeStyles[t.type]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
