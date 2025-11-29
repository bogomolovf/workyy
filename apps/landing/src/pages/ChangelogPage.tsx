import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const ChangelogPage = () => {
  const { language, content } = useLanguage()
  const changelogContent = content.changelog

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  return (
    <div className="bg-[var(--color-bg-root)] text-[var(--color-text-primary)] min-h-screen transition-theme">
      <SEOHead
        title={changelogContent.title}
        description={changelogContent.description}
        path={getPath('/changelog')}
      />

      <main className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(124,58,237,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-6">{changelogContent.title}</h1>
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">{changelogContent.description}</p>
        </div>
      </main>
    </div>
  )
}

export default ChangelogPage

