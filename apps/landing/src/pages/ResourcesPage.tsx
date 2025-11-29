import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const ResourcesPage = () => {
  const { resource } = useParams<{ resource?: string }>()
  const { language, content } = useLanguage()
  const resourcesContent = content.resources

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const resourceKeys = ['security', 'privacy', 'terms']
  const currentResource = resource && resourceKeys.includes(resource) ? resourcesContent[resource] : null

  if (currentResource) {
    return (
      <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen">
        <SEOHead
          title={currentResource.title}
          description={currentResource.description}
          path={getPath(`/resources/${resource}`)}
        />

        <main className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-6">{currentResource.title}</h1>
            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">{currentResource.description}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-root)] text-[var(--text-primary)] min-h-screen transition-colors duration-300">
      <SEOHead
        title="Resources"
        description="Security, privacy, and legal information."
          path={getPath('/resources')}
      />

      <main className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              {language === 'en' ? 'Resources' : 'Ресурсы'}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {language === 'en'
                ? 'Security, privacy, and legal information about Workyy.'
                : 'Безопасность, конфиденциальность и правовая информация о Workyy.'}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {resourceKeys.map((key) => {
              const res = resourcesContent[key]
              return (
                <Link
                  key={key}
                  to={getPath(`/resources/${key}`)}
                  className="surface-panel p-6 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]/80 transition-smooth"
                >
                  <h3 className="text-xl font-semibold mb-2">{res.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{res.description.substring(0, 150)}...</p>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ResourcesPage

