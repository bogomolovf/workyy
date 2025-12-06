import { useScrollPosition } from '../hooks/useScrollPosition';
import { useLanguage } from '../contexts/LanguageContext';

export const BackToTop = () => {
  const isVisible = useScrollPosition(400);
  const { language } = useLanguage();

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  if (!isVisible) return null;

  const label = language === 'en' ? 'Back to top' : 'Наверх';

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-wy-primary text-white shadow-lg hover:bg-wy-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-wy-primary focus-visible:outline-offset-2"
      aria-label={label}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
};
