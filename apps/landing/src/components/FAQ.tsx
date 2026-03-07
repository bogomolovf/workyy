import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const faqSectionTitle = { en: 'Frequently asked questions', ru: 'Часто задаваемые вопросы' };

export const FAQ = () => {
  const { language, content } = useLanguage();
  const faqs = content.home.faq;
  const [open, setOpen] = useState<number | null>(0);
  const title = faqSectionTitle[language as 'en' | 'ru'] ?? faqSectionTitle.en;

  return (
    <section id="faq" className="py-16 md:py-24 bg-[var(--page)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
          FAQ
        </p>
        <h2 className="wy-h2 text-[var(--text)] mb-10">{title}</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={faq.question}
              className="wy-glass rounded-[var(--r-md)] overflow-hidden border border-[var(--border)]"
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 py-4 px-5 text-left wy-body-medium text-[var(--text)] font-semibold hover:bg-[var(--surface)]/50 transition-colors"
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
              >
                {faq.question}
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] transition-transform"
                  aria-hidden
                >
                  {open === i ? '−' : '+'}
                </span>
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className={`overflow-hidden transition-all duration-200 ${
                  open === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="wy-body text-[var(--text-muted)] text-sm py-0 px-5 pb-4 pt-0">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
