import { useLanguage } from '../contexts/LanguageContext';

function MiniChartSvg() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" fill="none" className="opacity-60">
      <path
        d="M2 24 L12 18 L22 22 L32 10 L42 14 L48 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniTableSvg() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" fill="none" className="opacity-60">
      <rect x="2" y="2" width="44" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="10" x2="46" y2="10" stroke="currentColor" strokeWidth="1" />
      <line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" strokeWidth="1" />
      <line x1="32" y1="2" x2="32" y2="30" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

const useCaseSectionTitle = { en: 'Solutions for different tasks', ru: 'Решения для разных задач' };

export const UseCaseGrid = () => {
  const { language, content } = useLanguage();
  const useCases = content.useCases;
  const entries = Object.entries(useCases);
  const sectionTitle = useCaseSectionTitle[language as 'en' | 'ru'] ?? useCaseSectionTitle.en;
  const icons = [
    MiniChartSvg,
    MiniTableSvg,
    MiniChartSvg,
    MiniTableSvg,
    MiniChartSvg,
    MiniTableSvg,
  ];

  return (
    <section id="use-cases" className="py-16 md:py-24 bg-[var(--page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
          Use cases
        </p>
        <h2 className="wy-h2 text-[var(--text)] mb-12">{sectionTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries.slice(0, 6).map(([key, uc], i) => {
            const Icon = icons[i] ?? MiniChartSvg;
            return (
              <div
                key={key}
                className="wy-card rounded-[var(--r-md)] p-6 hover:border-[var(--accent-violet)] hover:shadow-[0 0 24px rgba(133,95,251,0.12)] transition-all duration-200"
              >
                <div className="flex items-center justify-center w-12 h-10 mb-3 text-[var(--accent-violet)]">
                  <Icon />
                </div>
                <h3 className="wy-body-medium text-[var(--text)] font-semibold mb-2">{uc.title}</h3>
                <p className="wy-body text-[var(--text-muted)] text-sm line-clamp-2">
                  {uc.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
