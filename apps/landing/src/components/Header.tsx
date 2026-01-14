import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useAuth } from '../hooks/useAuth';
import { PRODUCT_HOME_URL } from '../config/appConfig';

// Навигация удалена - весь контент на главной странице
const primaryNav: never[] = [];

export const Header = () => {
  const { language } = useLanguage();
  const { isActive } = useActiveRoute();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleMobileLinkClick = () => setMobileMenuOpen(false);
  const getPath = (path: string) => `/${language}${path}`;
  const skipLabel = language === 'en' ? 'Skip to content' : 'Перейти к контенту';

  const desktopLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path) ? 'text-wy-primary' : 'text-wy-muted hover:text-wy-text'
    }`;

  return (
    <>
      <a href="#main-content" className="skip-link">
        {skipLabel}
      </a>
      <header
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-wy-primary/20"
        style={{ width: '100vw', margin: 0, padding: 0, left: 0, right: 0, position: 'sticky' }}
      >
        <div style={{ width: '100%', margin: 0, padding: 0, maxWidth: '100%' }}>
          <div
            className="flex items-center justify-between h-16 md:h-18"
            style={{ width: '100%', margin: 0, padding: 0 }}
          >
            {/* Logo - строго слева */}
            <div className="pl-4 sm:pl-6 lg:pl-8 flex-shrink-0">
              <Link to={getPath('/home')} className="text-2xl font-bold text-wy-primary" style={{ letterSpacing: '-0.05em', textTransform: 'lowercase' }}>
                workyy
              </Link>
            </div>


            {/* Desktop Actions - строго справа у края */}
            <div className="flex items-center flex-shrink-0 pr-4 sm:pr-6 lg:pr-8">
              <div className="hidden md:flex items-center gap-4">
                <LanguageToggle />
                {!authLoading && user ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden lg:block">
                        <p className="text-sm font-medium text-wy-text">
                          {user.name || user.email}
                        </p>
                        {user.name && <p className="text-xs text-wy-muted">{user.email}</p>}
                      </div>
                      <a
                        href={PRODUCT_HOME_URL}
                        className="px-3 py-1.5 rounded-lg bg-wy-primary-soft text-wy-primary text-sm font-medium hover:bg-wy-primary-soft/80 transition-colors"
                      >
                        {language === 'en' ? 'Go to app' : 'В приложение'}
                      </a>
                      <button
                        onClick={logout}
                        className="px-3 py-1.5 rounded-lg border border-wy-border text-wy-muted text-sm font-medium hover:bg-wy-bg-subtle hover:text-wy-text transition-colors"
                      >
                        {language === 'en' ? 'Log out' : 'Выйти'}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden text-wy-muted hover:text-wy-text transition-colors p-2"
                style={{ marginRight: 0, paddingRight: 0 }}
                aria-label={language === 'en' ? 'Toggle menu' : 'Открыть меню'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                ref={mobileMenuRef}
                className="md:hidden fixed top-16 left-0 right-0 bg-white border-t border-wy-border z-50 overflow-y-auto shadow-lg"
              >
                <div className="px-4 py-6 space-y-1">
                  <div className="pt-4 border-t border-wy-border mt-4">
                    {!authLoading && user ? (
                      <>
                        <div className="px-4 py-3 mb-2">
                          <p className="text-sm font-medium text-wy-text">
                            {user.name || user.email}
                          </p>
                          {user.name && (
                            <p className="text-xs text-wy-muted mt-0.5">{user.email}</p>
                          )}
                        </div>
                        <a
                          href={PRODUCT_HOME_URL}
                          onClick={handleMobileLinkClick}
                          className="block px-4 py-3 rounded-lg text-sm font-semibold bg-wy-primary text-white hover:bg-wy-primary/90 transition-colors text-center"
                        >
                          {language === 'en' ? 'Go to app' : 'В приложение'}
                        </a>
                        <button
                          onClick={() => {
                            handleMobileLinkClick();
                            logout();
                          }}
                          className="w-full mt-2 px-4 py-3 rounded-lg text-sm font-medium border border-wy-border text-wy-muted hover:bg-wy-bg-subtle hover:text-wy-text transition-colors"
                        >
                          {language === 'en' ? 'Log out' : 'Выйти'}
                        </button>
                      </>
                    ) : null}
                    <div className="mt-4 px-4">
                      <LanguageToggle />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};
