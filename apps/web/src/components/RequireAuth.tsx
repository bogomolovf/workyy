'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../state/authStore';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized } = useAuthStore(
    useShallow((s) => ({ user: s.user, initialized: s.initialized })),
  );

  useEffect(() => {
    if (initialized && !user) {
      router.replace('/login?redirectTo=/');
    }
  }, [initialized, user, router]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
