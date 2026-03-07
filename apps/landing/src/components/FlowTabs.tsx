import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const flowHeadings = {
  en: 'From question to insight in seconds',
  ru: 'От вопроса к инсайту за секунды',
};

const previewLabels = {
  en: ['Connect', 'Query', 'Share'],
  ru: ['Подключение', 'Запрос', 'Шаринг'],
};

export const FlowTabs = () => {
  const { language, content } = useLanguage();
  const steps = content.home.flowSteps;
  const [active, setActive] = useState(0);
  const lang = language as 'en' | 'ru';
  const heading = flowHeadings[lang];
  const labels = previewLabels[lang];

  return (
    <section id="flow" className="py-16 md:py-24 bg-[var(--page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="wy-h2 text-[var(--text)] text-center mb-12">{heading}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex gap-2 mb-6" role="tablist">
              {steps.map((step, i) => (
                <button
                  key={step.title}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  onClick={() => setActive(i)}
                  className={`px-4 py-2 rounded-[var(--r-sm)] text-sm font-medium transition-colors ${
                    active === i
                      ? 'bg-[var(--primary)] text-[var(--primary-contrast)]'
                      : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
                  }`}
                >
                  {step.title}
                </button>
              ))}
            </div>
            {steps.map((step, i) => (
              <div
                key={step.title}
                role="tabpanel"
                id={`flow-panel-${i}`}
                hidden={active !== i}
                className={active === i ? 'block' : 'hidden'}
              >
                <h3 className="wy-body-medium text-[var(--text)] font-semibold mb-2">
                  {step.title}
                </h3>
                <p className="wy-body text-[var(--text-muted)]">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="wy-glass rounded-[var(--r-lg)] p-6 min-h-[240px] flex items-center justify-center">
            <div className="text-center">
              <span className="wy-code text-[var(--accent-cyan)] font-medium">
                {labels[active]}
              </span>
              <p className="wy-body text-[var(--text-muted)] mt-2 text-sm">
                {steps[active].description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
