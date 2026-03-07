import { useState } from 'react';
import { PRODUCT_HOME_URL } from '../config/appConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { PythonDemo, SqlDemo } from './HeroPreviewDemos';

type PreviewNodeId = 'sql' | 'python';

const nodeStyles: Record<PreviewNodeId, { bg: string; border: string; text: string }> = {
  sql: {
    bg: 'bg-[var(--accent-cyan)]/20',
    border: 'border-[var(--accent-cyan)]/40',
    text: 'text-[var(--accent-cyan)]',
  },
  python: {
    bg: 'bg-[var(--accent-blue)]/20',
    border: 'border-[var(--accent-blue)]/40',
    text: 'text-[var(--accent-blue)]',
  },
};

const widgetDoesLabel = { en: 'What this widget does', ru: 'Что делает этот виджет' };

export const Hero = () => {
  const { language, content } = useLanguage();
  const hero = content.home.hero;
  const preview = content.home.heroPreview;
  const [expandedNode, setExpandedNode] = useState<PreviewNodeId | null>(null);

  const stepsSource = expandedNode ? preview[expandedNode] : null;
  const steps = stepsSource?.steps ?? [];

  return (
    <section
      id="hero"
      className="relative min-h-[82vh] wy-hero-bg wy-dotgrid flex items-center overflow-hidden"
    >
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-on-hero)]/80 mb-4">
              {hero.eyebrow}
            </p>
            <h1 className="wy-h1 text-[var(--text-on-hero)] mb-5 max-w-2xl mx-auto lg:mx-0">
              {hero.title}
            </h1>
            <p className="wy-body text-[var(--text-on-hero)]/90 text-lg max-w-xl mx-auto lg:mx-0 mb-8">
              {hero.description}
            </p>
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-6">
              <a
                href={PRODUCT_HOME_URL}
                className="inline-flex items-center px-6 py-3 rounded-[var(--r-sm)] font-semibold bg-[var(--primary)] text-[var(--primary-contrast)] hover:opacity-90 transition-opacity shadow-[var(--shadow-md)]"
              >
                {hero.ctaPrimary}
              </a>
              <a
                href="#product"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center px-6 py-3 rounded-[var(--r-sm)] font-semibold border-2 border-[var(--text-on-hero)]/40 text-[var(--text-on-hero)] hover:bg-white/10 transition-colors"
              >
                {hero.ctaSecondary}
              </a>
            </div>
            <p className="text-sm text-[var(--text-on-hero)]/70 mb-4">{hero.trust}</p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {['SQL', 'Python', 'Charts'].map((badge) => (
                <span
                  key={badge}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-[var(--text-on-hero)] border border-white/20"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="wy-glass rounded-[var(--r-lg)] p-4 w-full max-w-md aspect-[4/3] shadow-[var(--shadow-md)] border border-white/20 relative overflow-hidden">
              <div className="absolute inset-4 rounded-lg bg-[var(--page)]/5 border border-[var(--border)]/50 overflow-hidden flex flex-col">
                {expandedNode ? (
                  <div className="absolute inset-0 rounded-lg bg-[var(--page)]/95 dark:bg-[var(--page)]/98 backdrop-blur-sm flex flex-col p-4 z-10 overflow-auto">
                    <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0">
                      <h3
                        className={`wy-body-medium font-semibold ${nodeStyles[expandedNode].text}`}
                      >
                        {preview[expandedNode].title}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedNode(null);
                        }}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mb-3 min-h-[72px] flex items-center flex-shrink-0">
                      {expandedNode === 'sql' && <SqlDemo />}
                      {expandedNode === 'python' && <PythonDemo />}
                    </div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5 flex-shrink-0">
                      {widgetDoesLabel[language as 'en' | 'ru'] ?? widgetDoesLabel.en}
                    </p>
                    <ul className="space-y-1 flex-shrink-0">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-[var(--text)]">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-[10px] font-semibold">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-2 w-full h-full min-h-0 place-content-center">
                    <button
                      type="button"
                      onClick={() => setExpandedNode('sql')}
                      className={`rounded-[var(--r-sm)] ${nodeStyles.sql.bg} border ${nodeStyles.sql.border} flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 shadow-sm min-h-[48px]`}
                      aria-label={preview.sql.title}
                    >
                      <span className={`wy-code text-[10px] ${nodeStyles.sql.text}`}>SQL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedNode('python')}
                      className={`rounded-[var(--r-sm)] ${nodeStyles.python.bg} border ${nodeStyles.python.border} flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 shadow-sm min-h-[48px]`}
                      aria-label={preview.python.title}
                    >
                      <span className={`wy-code text-[10px] ${nodeStyles.python.text}`}>
                        Python
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
