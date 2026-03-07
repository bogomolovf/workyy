import { useLanguage } from '../contexts/LanguageContext';
import { CardDemo, type CardDemoType } from './FeatureCardDemos';

const DEMO_TYPES: CardDemoType[] = ['drawing', 'audio', 'ai', 'collab', 'files', 'sql'];
const ICONS = ['✏️', '🎤', '🤖', '👥', '📁', '💾'];

const sectionTitle = {
  en: 'Everything you need for data work',
  ru: 'Всё необходимое для работы с данными',
};

export const FeatureGrid = () => {
  const { language, content } = useLanguage();
  const cards = content.home.featureCards;
  const title = sectionTitle[language as 'en' | 'ru'] ?? sectionTitle.en;

  return (
    <section id="product" className="py-16 md:py-24 bg-[var(--page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
          Product
        </p>
        <h2 className="wy-h2 text-[var(--text)] mb-12">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {cards.map((card, i) => (
            <div
              key={DEMO_TYPES[i]}
              className="wy-card rounded-[var(--r-md)] overflow-hidden hover:border-[var(--accent-cyan)] transition-all duration-200"
            >
              {/* Demo area — top 60-65% */}
              <CardDemo type={DEMO_TYPES[i]} />
              {/* Static text — bottom */}
              <div className="p-5">
                <span className="text-xl mb-2 block" aria-hidden>
                  {ICONS[i]}
                </span>
                <h3 className="wy-body-medium text-[var(--text)] font-semibold mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
