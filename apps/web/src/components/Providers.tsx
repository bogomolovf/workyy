'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';
import { useAuthStore } from '../state/authStore';
import { ThemeProvider } from './ThemeProvider';

type ProvidersProps = {
  children: ReactNode;
};

/** Monaco Editor can throw "Canceled" when the editor is disposed (e.g. unmount, navigation). Suppress it so it doesn't show as an unhandled runtime error. */
function isMonacoCanceledError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    return err.name === 'Canceled' || err.message === 'Canceled';
  }
  const msg = typeof err === 'string' ? err : String(err);
  return msg === 'Canceled' || msg === 'Canceled: Canceled';
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isMonacoCanceledError(event.error) || isMonacoCanceledError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
      return false;
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isMonacoCanceledError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    // Register in capture phase so we intercept before Next.js dev overlay
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection, true);
    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection, true);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
