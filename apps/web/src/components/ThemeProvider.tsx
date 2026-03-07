'use client';

import { useEffect } from 'react';
import { useSettingsStore, getEffectiveTheme } from '../state/settingsStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  useEffect(() => {
    const effective = getEffectiveTheme(theme);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.style.colorScheme = effective;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false');
  }, [reduceMotion]);

  return <>{children}</>;
}
