import { getMessages } from '../lib/translations';
import { useLocaleStore } from '../state/localeStore';
import type { Locale } from '../state/localeStore';

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = getMessages(locale);

  return { t, locale, setLocale };
}
