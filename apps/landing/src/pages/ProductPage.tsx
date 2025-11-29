import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'

const ProductPage = () => {
  const { section } = useParams<{ section?: string }>()
  const { language, content } = useLanguage()
  const productContent = content.product

  const getPath = (path: string) => {
    return `/${language}${path}`
  }

  const sections = [
    { id: 'canvas', content: productContent.canvas },
    { id: 'collaboration', content: productContent.collaboration },
    { id: 'performance', content: productContent.performance },
  ]

  const currentSection = section ? sections.find((s) => s.id === section) : null
  const displaySection = currentSection || sections[0]

  return (
    <div className="bg-white text-wy-text min-h-screen">
      <SEOHead
        title={`${displaySection.content.title} - Product`}
        description={displaySection.content.description}
        path={getPath(`/product/${displaySection.id}`)}
      />

      <main className="relative overflow-hidden py-20">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Navigation */}
          <div className="mb-12 flex gap-4 border-b border-wy-border pb-4">
            {sections.map((s) => (
              <Link
                key={s.id}
                to={getPath(`/product/${s.id}`)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  (section === s.id || (!section && s.id === 'canvas'))
                    ? 'bg-wy-primary text-white'
                    : 'bg-white hover:bg-wy-bg-subtle text-wy-muted'
                }`}
              >
                {s.content.title}
              </Link>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-6 text-wy-text">{displaySection.content.title}</h1>
              <p className="text-lg text-wy-muted leading-relaxed mb-8">{displaySection.content.description}</p>
              <Link
                to={getPath('/pricing')}
                className="inline-block px-6 py-3 rounded-lg bg-wy-primary text-white font-semibold hover:bg-wy-primary/90 transition-colors"
              >
                {displaySection.content.cta}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ProductPage

