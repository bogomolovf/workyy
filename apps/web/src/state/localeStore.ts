import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'workyy-locale';

function detectDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ru') || lang.startsWith('be') || lang.startsWith('uk')) {
    return 'ru';
  }
  return 'en';
}

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: detectDefaultLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);
