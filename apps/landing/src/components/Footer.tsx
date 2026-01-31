import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

const footerCopy = {
  en: {
    brandTitle: 'Workyy',
    brandDescription: 'Canvas for analytics with SQL and Python.',
    columns: [
      {
        title: 'Product',
        links: [
          { path: '/product/canvas', label: 'Overview' },
          { path: '/product/canvas', label: 'Product' },
          { path: '/integrations/postgres', label: 'Integrations' },
        ],
      },
      {
        title: 'Company',
        links: [
          { path: '/about', label: 'About' },
          { path: '/changelog', label: 'Changelog' },
          { path: '/roadmap', label: 'Roadmap' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { path: '/resources/docs', label: 'Docs' },
          { path: '/resources/templates', label: 'Blog' },
          { path: '/resources/security', label: 'Support' },
        ],
      },
    ],
  },
  ru: {
    brandTitle: 'Workyy',
    brandDescription: 'Канва для аналитики с SQL и Python.',
    columns: [
      {
        title: 'Продукт',
        links: [
          { path: '/product/canvas', label: 'Обзор' },
          { path: '/product/canvas', label: 'Продукт' },
          { path: '/integrations/postgres', label: 'Интеграции' },
        ],
      },
      {
        title: 'Компания',
        links: [
          { path: '/about', label: 'О нас' },
          { path: '/changelog', label: 'Changelog' },
          { path: '/roadmap', label: 'Дорожная карта' },
        ],
      },
      {
        title: 'Ресурсы',
        links: [
          { path: '/resources/docs', label: 'Документация' },
          { path: '/resources/templates', label: 'Блог' },
          { path: '/resources/security', label: 'Поддержка' },
        ],
      },
    ],
  },
};

export const Footer = () => {
  const { language } = useLanguage();
  const copy = footerCopy[language as 'en' | 'ru'] ?? footerCopy.ru;

  const getPath = (path: string) => {
    return `/${language}${path}`;
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-wy-primary-soft border-t border-wy-primary/20 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <h3
              className="text-xl font-bold text-wy-primary"
              style={{ letterSpacing: '-0.05em', textTransform: 'lowercase' }}
            >
              workyy
            </h3>
            <p className="text-sm text-wy-muted">{copy.brandDescription}</p>
          </div>

          {/* Links Columns */}
          {copy.columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-semibold text-wy-primary mb-3 text-sm">{column.title}</h4>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={getPath(link.path)}
                      className="text-sm text-wy-muted hover:text-wy-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-wy-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-wy-muted">
          <p>© {currentYear} workyy. Все права защищены.</p>
          <div className="flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};
