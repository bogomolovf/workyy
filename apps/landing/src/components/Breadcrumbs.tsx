import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export const Breadcrumbs = () => {
  const { language } = useLanguage();
  const location = useLocation();

  const getPath = (path: string) => {
    return `/${language}${path}`;
  };

  // Build breadcrumbs from current path
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const path = location.pathname.replace(/^\/(en|ru)/, '');
    const segments = path.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];

    // Always start with Home
    crumbs.push({ label: language === 'en' ? 'Home' : 'Главная', path: '/home' });

    if (segments.length === 0) return crumbs;

    // Map segments to labels
    const segmentLabels: Record<string, { en: string; ru: string }> = {
      product: { en: 'Product', ru: 'Продукт' },
      canvas: { en: 'The Canvas', ru: 'Канва' },
      collaboration: { en: 'Collaboration', ru: 'Сотрудничество' },
      performance: { en: 'Performance', ru: 'Производительность' },
      pricing: { en: 'Pricing', ru: 'Цены' },
      'use-cases': { en: 'Use Cases', ru: 'Случаи использования' },
      compare: { en: 'Compare', ru: 'Сравнение' },
      integrations: { en: 'Integrations', ru: 'Интеграции' },
      resources: { en: 'Resources', ru: 'Ресурсы' },
      changelog: { en: 'Changelog', ru: 'История изменений' },
      roadmap: { en: 'Roadmap', ru: 'Дорожная карта' },
    };

    let currentPath = '';
    segments.forEach((segment) => {
      currentPath += `/${segment}`;
      const label = segmentLabels[segment]?.[language] || segment;
      crumbs.push({ label, path: currentPath });
    });

    return crumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label={language === 'en' ? 'Breadcrumb' : 'Навигационная цепочка'} className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-wy-muted">
        {breadcrumbs.map((crumb, idx) => (
          <li key={crumb.path} className="flex items-center">
            {idx > 0 && (
              <svg
                className="w-4 h-4 mx-2 text-wy-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-wy-text font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link to={getPath(crumb.path)} className="hover:text-wy-primary transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
