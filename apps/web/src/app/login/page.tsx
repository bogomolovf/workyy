'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../state/authStore';
import { LANDING_URL } from '../../lib/appConfig';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = searchParams.get('redirectTo') || '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password });
      router.push(redirectTo);
    } catch (err) {
      // Error is already in store
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Log in to Workyy</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back! Continue where you left off.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="text-xs text-slate-500">
          Don't have an account?{' '}
          <a href="/signup" className="text-indigo-600 hover:text-indigo-700">
            Sign up
          </a>
        </p>
        <p className="text-xs text-center text-slate-500">
          <a href={LANDING_URL} className="text-slate-400 hover:text-slate-600">
            ← Back to website
          </a>
        </p>
      </div>
    </main>
  );
}
