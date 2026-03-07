import { PRODUCT_HOME_URL } from '../config/appConfig';
import { useLanguage } from '../contexts/LanguageContext';

const mostPopularLabel = { en: 'Most popular', ru: 'Популярный' };

export const Pricing = () => {
  const { language, content } = useLanguage();
  const pricing = content.pricing;
  const lang = language as 'en' | 'ru';
  const popularLabel = mostPopularLabel[lang];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-[var(--page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
          Pricing
        </p>
        <h2 className="wy-h2 text-[var(--text)] mb-4">{pricing.title}</h2>
        <p className="wy-body text-[var(--text-muted)] max-w-2xl mb-12">{pricing.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {pricing.plans.map((plan) => (
            <div
              key={plan.name}
              className={`wy-card rounded-[var(--r-md)] p-6 flex flex-col ${
                plan.highlight ? 'ring-2 ring-[var(--primary)] shadow-[var(--ring)]' : ''
              }`}
            >
              {plan.highlight && (
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[var(--primary)] mb-3">
                  {popularLabel}
                </span>
              )}
              <h3 className="wy-body-medium text-[var(--text)] font-bold text-lg mb-2">
                {plan.name}
              </h3>
              <p className="text-xl font-semibold text-[var(--primary)] mb-4">{plan.price}</p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--text-muted)] flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <a
                href={PRODUCT_HOME_URL}
                className={`inline-flex items-center justify-center px-4 py-3 rounded-[var(--r-sm)] font-semibold text-sm transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? 'bg-[var(--primary)] text-[var(--primary-contrast)]'
                    : plan.name === 'Free'
                      ? 'border-2 border-[var(--primary)] text-[var(--primary)]'
                      : 'border border-[var(--border)] text-[var(--text)]'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
