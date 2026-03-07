import { useLanguage } from '../contexts/LanguageContext';

export const ProofStats = () => {
  const { content } = useLanguage();
  const stats = content.home.proofStats;

  return (
    <section id="trusted" className="py-16 md:py-20 bg-[var(--page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((item) => (
            <div
              key={item.label}
              className="wy-card rounded-[var(--r-md)] p-6 text-center hover:border-[var(--accent-cyan)] hover:shadow-[0 0 24px rgba(84,213,250,0.15)] transition-all duration-200"
            >
              <p className="wy-body-medium text-[var(--text)] font-semibold">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
