import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { getContent } from '../data/content';
import { LanguageToggle } from './LanguageToggle';

const footerColumns = {
  en: [
    {
      title: 'Product',
      links: ['canvas', 'collaboration', 'performance', 'pricing', 'changelog', 'roadmap'] as const,
    },
    {
      title: 'Use cases',
      links: [
        'dataAnalysis',
        'selfServe',
        'reporting',
        'dataModeling',
        'productAnalytics',
        'financeOps',
      ] as const,
    },
    { title: 'Compare', links: ['classicBi', 'notebooks', 'smallTeams', 'startups'] as const },
    { title: 'Resources', links: ['security', 'privacy', 'terms'] as const },
  ],
  ru: [
    {
      title: 'Продукт',
      links: ['canvas', 'collaboration', 'performance', 'pricing', 'changelog', 'roadmap'] as const,
    },
    {
      title: 'Кейсы',
      links: [
        'dataAnalysis',
        'selfServe',
        'reporting',
        'dataModeling',
        'productAnalytics',
        'financeOps',
      ] as const,
    },
    { title: 'Сравнение', links: ['classicBi', 'notebooks', 'smallTeams', 'startups'] as const },
    { title: 'Ресурсы', links: ['security', 'privacy', 'terms'] as const },
  ],
};

const linkPaths: Record<string, string> = {
  canvas: '/home#product',
  collaboration: '/home#product',
  performance: '/home#product',
  pricing: '/home#pricing',
  changelog: '/changelog',
  roadmap: '/roadmap',
  dataAnalysis: '/home#use-cases',
  selfServe: '/home#use-cases',
  reporting: '/home#use-cases',
  dataModeling: '/home#use-cases',
  productAnalytics: '/home#use-cases',
  financeOps: '/home#use-cases',
  classicBi: '/home#product',
  notebooks: '/home#product',
  smallTeams: '/home#product',
  startups: '/home#product',
  security: '/resources/security',
  privacy: '/resources/privacy',
  terms: '/resources/terms',
};

export const Footer = () => {
  const { language } = useLanguage();
  const copy = getContent(language);
  const columns = footerColumns[language as 'en' | 'ru'] ?? footerColumns.en;
  const footer = copy.footer;
  const getPath = (path: string) => `/${language}${path}`;
  const currentYear = new Date().getFullYear();

  const getLabel = (colTitle: string, key: string): string => {
    if (colTitle === columns[0].title)
      return (footer.product as Record<string, string>)[key] ?? key;
    if (colTitle === columns[1].title)
      return (footer.useCases as Record<string, string>)[key] ?? key;
    if (colTitle === columns[2].title)
      return (footer.compare as Record<string, string>)[key] ?? key;
    if (colTitle === columns[3].title)
      return (footer.resources as Record<string, string>)[key] ?? key;
    return key;
  };

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--page)] py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <h3
              className="text-xl font-bold text-[var(--text)]"
              style={{
                fontFamily: 'Space Grotesk',
                letterSpacing: '-0.05em',
                textTransform: 'lowercase',
              }}
            >
              workyy
            </h3>
            <p className="wy-body text-sm text-[var(--text-muted)]">{footer.brandDescription}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-[var(--text)] mb-3 text-sm">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((linkKey) => (
                  <li key={linkKey}>
                    <Link
                      to={getPath(linkPaths[linkKey] ?? '/home')}
                      className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                    >
                      {getLabel(col.title, linkKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[var(--text-muted)]">
          <p>
            © {currentYear} workyy.{' '}
            {language === 'en' ? 'All rights reserved.' : 'Все права защищены.'}
          </p>
          <div className="flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};
