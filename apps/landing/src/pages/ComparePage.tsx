import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const ComparePage = () => {
  const { comparison } = useParams<{ comparison?: string }>()
  const { language, content } = useLanguage()
  const compareContent = content.compare

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const comparisonKeys = ['classic-bi', 'notebooks', 'small-teams', 'startups']
  const currentComparison = comparison && comparisonKeys.includes(comparison) ? compareContent[comparison] : null

  if (currentComparison) {
    return (
      <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen">
        <SEOHead
          title={currentComparison.title}
          description={currentComparison.description}
          path={getPath(`/compare/${comparison}`)}
        />

        <main className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold mb-6">{currentComparison.title}</h1>
            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-8">{currentComparison.description}</p>
            <Link
              to={getPath('/pricing')}
              className="inline-block px-6 py-3 rounded-md bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold hover:opacity-90 transition-smooth"
            >
              {currentComparison.cta}
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen transition-theme">
      <SEOHead
        title="Compare"
        description="See how Workyy compares to other analytics tools."
        path={getPath('/compare')}
      />

      <main className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{language === 'en' ? 'Compare' : 'Сравнение'}</h1>
            <p className="text-[var(--color-text-secondary)]">
              {language === 'en'
                ? 'See how Workyy compares to other analytics solutions.'
                : 'Узнайте, как Workyy сравнивается с другими аналитическими решениями.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {comparisonKeys.map((key) => {
              const comp = compareContent[key]
              return (
                <Link
                  key={key}
                  to={getPath(`/compare/${key}`)}
                  className="surface-panel p-6 rounded-2xl border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]/80 transition-smooth"
                >
                  <h3 className="text-xl font-semibold mb-2">{comp.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{comp.description.substring(0, 200)}...</p>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ComparePage

