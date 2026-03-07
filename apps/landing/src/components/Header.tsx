import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_HOME_URL } from '../config/appConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { LanguageToggle } from './LanguageToggle';

const navAnchors = {
  en: [
    { id: 'product', label: 'Product' },
    { id: 'use-cases', label: 'Use cases' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'faq', label: 'FAQ' },
  ],
  ru: [
    { id: 'product', label: 'Продукт' },
    { id: 'use-cases', label: 'Кейсы' },
    { id: 'pricing', label: 'Цены' },
    { id: 'faq', label: 'FAQ' },
  ],
};

export const Header = () => {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        mobileMenuOpen
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleAnchor = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const anchors = navAnchors[language as 'en' | 'ru'] ?? navAnchors.en;
  const getPath = (path: string) => `/${language}${path}`;
  const skipLabel = language === 'en' ? 'Skip to content' : 'Перейти к контенту';

  return (
    <>
      <a href="#main-content" className="skip-link">
        {skipLabel}
      </a>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? 'wy-glass border-b border-wy-border'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-18">
            <Link
              to={getPath('/home')}
              className="text-xl font-bold text-wy-text hover:opacity-90 transition-opacity"
              style={{
                fontFamily: 'Space Grotesk',
                letterSpacing: '-0.05em',
                textTransform: 'lowercase',
              }}
            >
              workyy
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {anchors.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAnchor(a.id)}
                  className="text-sm font-medium text-wy-muted hover:text-wy-text transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <LanguageToggle />
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-lg text-wy-muted hover:text-wy-text hover:bg-[var(--surface)] transition-colors"
                aria-label={
                  theme === 'light'
                    ? language === 'en'
                      ? 'Dark mode'
                      : 'Тёмная тема'
                    : language === 'en'
                      ? 'Light mode'
                      : 'Светлая тема'
                }
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                )}
              </button>
              {!authLoading && user ? (
                <>
                  <a
                    href={PRODUCT_HOME_URL}
                    className="hidden lg:inline-flex items-center px-4 py-2 rounded-[var(--r-sm)] text-sm font-medium bg-[var(--primary)] text-[var(--primary-contrast)] hover:opacity-90 transition-opacity"
                  >
                    {language === 'en' ? 'Go to app' : 'В приложение'}
                  </a>
                  <button
                    type="button"
                    onClick={logout}
                    className="hidden lg:inline-flex items-center px-4 py-2 rounded-[var(--r-sm)] text-sm font-medium border border-wy-border text-wy-muted hover:text-wy-text transition-colors"
                  >
                    {language === 'en' ? 'Log out' : 'Выйти'}
                  </button>
                </>
              ) : (
                <a
                  href={PRODUCT_HOME_URL}
                  className="inline-flex items-center px-4 py-2.5 rounded-[var(--r-sm)] text-sm font-semibold bg-[var(--primary)] text-[var(--primary-contrast)] hover:opacity-90 transition-opacity"
                >
                  {language === 'en' ? 'Start for free' : 'Попробовать бесплатно'}
                </a>
              )}

              <button
                type="button"
                onClick={() => setMobileMenuOpen((p) => !p)}
                className="md:hidden p-2 text-wy-muted hover:text-wy-text"
                aria-label={language === 'en' ? 'Toggle menu' : 'Меню'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />
            <div
              ref={mobileMenuRef}
              className="md:hidden fixed top-16 left-0 right-0 wy-glass border-b border-wy-border z-50 py-4 px-4"
            >
              <nav className="flex flex-col gap-1">
                {anchors.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleAnchor(a.id)}
                    className="text-left py-3 px-4 text-wy-text font-medium rounded-[var(--r-sm)] hover:bg-[var(--surface)]"
                  >
                    {a.label}
                  </button>
                ))}
              </nav>
              <div className="mt-4 pt-4 border-t border-wy-border flex flex-col gap-2">
                <LanguageToggle />
                {user ? (
                  <>
                    <a
                      href={PRODUCT_HOME_URL}
                      className="py-3 px-4 rounded-[var(--r-sm)] text-center font-semibold bg-[var(--primary)] text-[var(--primary-contrast)]"
                    >
                      {language === 'en' ? 'Go to app' : 'В приложение'}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="py-3 px-4 rounded-[var(--r-sm)] border border-wy-border text-wy-muted"
                    >
                      {language === 'en' ? 'Log out' : 'Выйти'}
                    </button>
                  </>
                ) : (
                  <a
                    href={PRODUCT_HOME_URL}
                    className="py-3 px-4 rounded-[var(--r-sm)] text-center font-semibold bg-[var(--primary)] text-[var(--primary-contrast)]"
                  >
                    {language === 'en' ? 'Start for free' : 'Попробовать бесплатно'}
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </header>
    </>
  );
};
