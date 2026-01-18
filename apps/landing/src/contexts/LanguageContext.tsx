import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getContent, type Language, type Content } from '../data/content';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  content: Content;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  // ВСЕГДА русский по умолчанию, игнорируя localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    const path = window.location.pathname;
    // Если путь явно указывает на английский - используем английский
    if (path.startsWith('/en/')) return 'en';
    // Во всех остальных случаях (включая /ru/ и корень) - русский по умолчанию
    // Игнорируем localStorage - всегда русский по умолчанию
    return 'ru';
  });

  useEffect(() => {
    const path = location.pathname;
    // Обновляем язык только если явно указан английский
    if (path.startsWith('/en/')) {
      setLanguageState('en');
    } else {
      // Для всех остальных путей (включая /ru/ и корень) - русский
      setLanguageState('ru');
    }
  }, [location.pathname]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    // Сохраняем только если явно выбран английский, иначе используем русский по умолчанию
    if (lang === 'en') {
      localStorage.setItem('workyy-language', lang);
    } else {
      // Для русского языка удаляем сохраненное значение, чтобы всегда использовать дефолт
      localStorage.removeItem('workyy-language');
    }
  };

  const content = getContent(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, content }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
