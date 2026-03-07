import { PRODUCT_HOME_URL } from '../config/appConfig';
import { useLanguage } from '../contexts/LanguageContext';

export const FinalCTA = () => {
  const { content } = useLanguage();
  const cta = content.home.future.cta;

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'linear-gradient(135deg, rgba(84,213,250,0.15) 0%, rgba(91,159,252,0.12) 35%, rgba(96,114,252,0.1) 60%, rgba(133,95,251,0.12) 85%, rgba(77,12,204,0.15) 110%)',
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="wy-h2 text-[var(--text)] mb-6">{content.home.future.title}</h2>
        <p className="wy-body text-[var(--text-muted)] mb-8">{cta}</p>
        <a
          href={PRODUCT_HOME_URL}
          className="inline-flex items-center px-8 py-4 rounded-[var(--r-sm)] font-semibold bg-[var(--primary)] text-[var(--primary-contrast)] hover:opacity-90 transition-opacity shadow-[var(--shadow-md)]"
        >
          {content.home.hero.ctaPrimary}
        </a>
      </div>
    </section>
  );
};
