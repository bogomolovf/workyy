'use client';

import { Gear } from '@phosphor-icons/react';
import Link from 'next/link';
import { useTranslation } from '../../hooks/useTranslation';

export function SettingsButton() {
  const { t } = useTranslation();

  return (
    <Link
      href="/user-profile"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
      aria-label={t.settingsButton}
    >
      <Gear size={20} weight="regular" />
    </Link>
  );
}
