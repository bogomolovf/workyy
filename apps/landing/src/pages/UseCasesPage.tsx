import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const UseCasesPage = () => {
  const { case: caseSlug } = useParams<{ case?: string }>()
  const { language, content } = useLanguage()
  const useCasesContent = content.useCases

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const useCaseKeys = ['data-analysis', 'self-serve', 'reporting', 'data-modeling', 'product-analytics', 'finance-ops']
  const currentCase = caseSlug && useCaseKeys.includes(caseSlug) ? useCasesContent[caseSlug] : null

  if (currentCase) {
    return (
      <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen">
        <SEOHead
          title={currentCase.title}
          description={currentCase.description}
          path={getPath(`/use-cases/${caseSlug}`)}
        />

        <main className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-6">{currentCase.title}</h1>
            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-8">{currentCase.description}</p>
            <Link
              to={getPath('/pricing')}
              className="inline-block px-6 py-3 rounded-md bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold hover:opacity-90 transition-smooth"
            >
              {currentCase.cta}
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen transition-theme">
      <SEOHead
        title="Use Cases"
        description="Discover how Workyy can help your team with data analysis, reporting, and more."
        path={getPath('/use-cases')}
      />

      <main className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              {language === 'en' ? 'Use Cases' : 'Варианты использования'}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {language === 'en'
                ? 'See how Workyy helps teams across different industries and roles.'
                : 'Узнайте, как Workyy помогает командам в разных отраслях и ролях.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCaseKeys.map((key) => {
              const useCase = useCasesContent[key]
              return (
                <Link
                  key={key}
                  to={getPath(`/use-cases/${key}`)}
                  className="surface-panel p-6 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]/80 transition-smooth"
                >
                  <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{useCase.description.substring(0, 150)}...</p>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default UseCasesPage

