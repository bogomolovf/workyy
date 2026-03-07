'use client';

import { useTranslation } from '../hooks/useTranslation';
import type { Locale } from '../state/localeStore';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
      <button
        type="button"
        onClick={() => setLocale('ru' as Locale)}
        className={`rounded px-2 py-1 text-sm font-medium transition ${
          locale === 'ru' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        RU
      </button>
      <span className="text-slate-300">|</span>
      <button
        type="button"
        onClick={() => setLocale('en' as Locale)}
        className={`rounded px-2 py-1 text-sm font-medium transition ${
          locale === 'en' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        EN
      </button>
    </div>
  );
}
