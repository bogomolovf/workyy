import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const IntegrationsPage = () => {
  const { integration } = useParams<{ integration?: string }>()
  const { language, content } = useLanguage()
  const integrationsContent = content.integrations

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const integrationSlugs = [
    { slug: 'postgres', key: 'postgres' as const },
    { slug: 'snowflake', key: 'snowflake' as const },
    { slug: 'bigquery', key: 'bigquery' as const },
    { slug: 'mysql', key: 'mysql' as const },
    { slug: 'csv-files', key: 'csv' as const },
  ]
  const currentConfig = integrationSlugs.find((item) => item.slug === integration)
  const currentIntegration = currentConfig ? integrationsContent[currentConfig.key] : null

  if (currentIntegration) {
    return (
      <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen">
        <SEOHead
          title={currentIntegration.title}
          description={currentIntegration.description}
          path={getPath(`/integrations/${integration}`)}
        />

        <main className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-6">{currentIntegration.title}</h1>
            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">{currentIntegration.description}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-root)] text-[var(--text-primary)] min-h-screen transition-colors duration-300">
      <SEOHead
        title="Integrations"
        description="Connect Workyy to your data sources."
          path={getPath('/integrations')}
      />

      <main className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              {language === 'en' ? 'Integrations' : 'Интеграции'}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {language === 'en'
                ? 'Connect Workyy to your favorite data sources.'
                : 'Подключите Workyy к вашим источникам данных.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrationSlugs.map(({ slug, key }) => {
              const integ = integrationsContent[key]
              return (
                <Link
                  key={slug}
                  to={getPath(`/integrations/${slug}`)}
                  className="surface-panel p-6 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]/80 transition-smooth"
                >
                  <h3 className="text-xl font-semibold mb-2">{integ.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{integ.description.substring(0, 150)}...</p>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default IntegrationsPage

