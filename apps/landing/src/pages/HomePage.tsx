import { useLanguage } from '../contexts/LanguageContext'
import { SEOHead } from '../components/SEOHead'
import { AnimatedSection } from '../components/ui/AnimatedSection'
import { AnimatedCard } from '../components/ui/AnimatedCard'
import { PRODUCT_SIGNUP_URL, PRODUCT_HOME_URL } from '../config/appConfig'

const heroContent = {
  en: {
    eyebrow: 'Analytics Canvas',
    headline: 'SQL, Python, and visualizations on one infinite canvas',
    subheadline: 'Build data pipelines, create visualizations, and collaborate with your team—all in one place.',
    ctas: {
      primary: 'Start for free',
      secondary: 'See demo boards',
    },
    trust: 'No credit card required',
  },
  ru: {
    eyebrow: 'Канва для аналитики',
    headline: 'SQL, Python и визуализации на одном бесконечном полотне',
    subheadline: 'Создавайте пайплайны данных, визуализации и работайте вместе с командой — всё в одном месте.',
    ctas: {
      primary: 'Попробовать бесплатно',
      secondary: 'Посмотреть демо-доски',
    },
    trust: 'Без карты',
  },
}

const socialProofLogos = [
  'Helios Pay',
  'Nuo Commerce',
  'Shenzhen Nebula Analytics',
  'Atlas Freight',
  'Bloomly Health',
  'Voltwave Gaming',
]

const valueProps = {
  en: [
    {
      title: 'Visual canvas',
      description: 'SQL, Python, charts, and notes on one infinite surface.',
    },
    {
      title: 'SQL + Python',
      description: 'Run code, import libraries, and keep results reproducible.',
    },
    {
      title: 'Reusable visualizations',
      description: 'Create charts and dashboards that update automatically.',
    },
    {
      title: 'Collaboration',
      description: 'Share boards, comment, and work together in real time.',
    },
  ],
  ru: [
    {
      title: 'Визуальная канва',
      description: 'SQL, Python, графики и заметки на одном бесконечном полотне.',
    },
    {
      title: 'SQL + Python',
      description: 'Запускайте код, импортируйте библиотеки, сохраняйте результаты.',
    },
    {
      title: 'Переиспользуемые визуализации',
      description: 'Создавайте графики и дашборды, которые обновляются автоматически.',
    },
    {
      title: 'Коллаборация',
      description: 'Делитесь досками, комментируйте и работайте вместе в реальном времени.',
    },
  ],
}

const howSteps = {
  en: [
    {
      title: 'Connect your data',
      description: 'Connect databases or upload CSV/Parquet files.',
      icon: '📊',
    },
    {
      title: 'Build with SQL + Python',
      description: 'Create data flows with code cells and queries.',
      icon: '💻',
    },
    {
      title: 'Add visualizations',
      description: 'Create charts and dashboards from your data.',
      icon: '📈',
    },
    {
      title: 'Share with team',
      description: 'Invite teammates and collaborate in real time.',
      icon: '👥',
    },
  ],
  ru: [
    {
      title: 'Подключите данные',
      description: 'Подключите базы данных или загрузите CSV/Parquet файлы.',
      icon: '📊',
    },
    {
      title: 'Создавайте с SQL + Python',
      description: 'Стройте потоки данных с помощью ячеек кода и запросов.',
      icon: '💻',
    },
    {
      title: 'Добавьте визуализации',
      description: 'Создавайте графики и дашборды из ваших данных.',
      icon: '📈',
    },
    {
      title: 'Делитесь с командой',
      description: 'Приглашайте коллег и работайте вместе в реальном времени.',
      icon: '👥',
    },
  ],
}

const featureGroups = {
  en: [
    {
      title: 'Canvas & Layout',
      bullets: [
        'Infinite, zoomable surface',
        'Frames and presentation mode',
        'Sticky notes and drawings',
        'Snapshot timeline',
      ],
    },
    {
      title: 'Code & Data',
      bullets: [
        'SQL and Python runtime',
        'Database connectors',
        'Rich table and chart viewers',
        'Data profiling',
      ],
    },
    {
      title: 'Collaboration',
      bullets: [
        'Live multi-cursor editing',
        'Comments and mentions',
        'Board permissions',
        'Share links',
      ],
    },
    {
      title: 'Governance',
      bullets: [
        'Role-based access control',
        'Audit logs',
        'Scheduled refreshes',
        'Export to PDF/PNG',
      ],
    },
  ],
  ru: [
    {
      title: 'Канва и макет',
      bullets: [
        'Бесконечная масштабируемая поверхность',
        'Фреймы и режим презентации',
        'Стикеры и рисунки',
        'Таймлайн снимков',
      ],
    },
    {
      title: 'Код и данные',
      bullets: [
        'SQL и Python runtime',
        'Подключения к БД',
        'Просмотр таблиц и графиков',
        'Профилирование данных',
      ],
    },
    {
      title: 'Коллаборация',
      bullets: [
        'Многокурсорное редактирование',
        'Комментарии и упоминания',
        'Права доступа к доскам',
        'Ссылки для шаринга',
      ],
    },
    {
      title: 'Управление',
      bullets: [
        'Ролевой доступ',
        'Журналы аудита',
        'Плановые обновления',
        'Экспорт в PDF/PNG',
      ],
    },
  ],
}

const personas = {
  en: [
    {
      title: 'Data Analysts',
      description: 'Run code, annotate, and present on one surface.',
    },
    {
      title: 'Analytics Engineers',
      description: 'Component-based boards with reproducible runs.',
    },
    {
      title: 'Product Managers',
      description: 'Comment on charts and watch live experiments.',
    },
    {
      title: 'Founders & Teams',
      description: 'Start from templates and connect spreadsheets.',
    },
  ],
  ru: [
    {
      title: 'Аналитики данных',
      description: 'Запускайте код, комментируйте и презентуйте на одной поверхности.',
    },
    {
      title: 'Инженеры аналитики',
      description: 'Компонентные доски с воспроизводимыми запусками.',
    },
    {
      title: 'Продакт-менеджеры',
      description: 'Комментируйте графики и следите за экспериментами.',
    },
    {
      title: 'Основатели и команды',
      description: 'Начинайте с шаблонов и подключайте таблицы.',
    },
  ],
}

const pricingPlans = {
  en: [
    {
      name: 'Starter',
      audience: 'Solo analysts',
      bullets: ['Unlimited boards', 'File uploads', 'Community support'],
    },
    {
      name: 'Team',
      audience: 'Growing teams',
      bullets: ['Database connectors', 'Shared workspaces', 'Snapshot history'],
    },
    {
      name: 'Pro',
      audience: 'Enterprise',
      bullets: ['SSO/SAML', 'Audit logs', 'Premium support'],
    },
  ],
  ru: [
    {
      name: 'Starter',
      audience: 'Индивидуальные аналитики',
      bullets: ['Неограниченные доски', 'Загрузка файлов', 'Поддержка сообщества'],
    },
    {
      name: 'Team',
      audience: 'Растущие команды',
      bullets: ['Подключения к БД', 'Общие workspace', 'История снимков'],
    },
    {
      name: 'Pro',
      audience: 'Enterprise',
      bullets: ['SSO/SAML', 'Журналы аудита', 'Премиум поддержка'],
    },
  ],
}

const faqs = {
  en: [
    {
      question: 'Is my data secure?',
      answer: 'Yes. Workyy encrypts data in transit and at rest, follows SOC 2-ready practices.',
    },
    {
      question: 'Which databases are supported?',
      answer: 'Snowflake, BigQuery, Redshift, Postgres, MySQL, plus CSV and Parquet uploads.',
    },
    {
      question: 'Can I control who edits a board?',
      answer: 'Set per-board roles (view, comment, edit) and audit every interaction.',
    },
    {
      question: 'Do you offer a free trial?',
      answer: 'Starter is free forever. Team and Pro plans include a 14-day trial.',
    },
    {
      question: 'How does collaboration work?',
      answer: 'Multi-cursor editing, comments, and real-time updates keep everyone in sync.',
    },
  ],
  ru: [
    {
      question: 'Безопасны ли мои данные?',
      answer: 'Да. Workyy шифрует данные при передаче и хранении, следует практикам SOC 2.',
    },
    {
      question: 'Какие БД поддерживаются?',
      answer: 'Snowflake, BigQuery, Redshift, Postgres, MySQL, а также загрузка CSV и Parquet.',
    },
    {
      question: 'Могу ли я контролировать доступ?',
      answer: 'Устанавливайте роли на доску (просмотр, комментарии, редактирование) и аудируйте взаимодействия.',
    },
    {
      question: 'Есть ли бесплатный пробный период?',
      answer: 'Starter бесплатен навсегда. Team и Pro включают 14-дневный пробный период.',
    },
    {
      question: 'Как работает коллаборация?',
      answer: 'Многокурсорное редактирование, комментарии и обновления в реальном времени синхронизируют всех.',
    },
  ],
}

const HomePage = () => {
  const { language } = useLanguage()
  const lang = language as 'en' | 'ru'

  const getPath = (path: string) => `/${language}${path}`

  const hero = heroContent[lang]
  const valuePropsList = valueProps[lang]
  const howStepsList = howSteps[lang]
  const featureGroupsList = featureGroups[lang]
  const personasList = personas[lang]
  const pricingPlansList = pricingPlans[lang]
  const faqsList = faqs[lang]

  return (
    <>
      <SEOHead
        title="Workyy | Analytics Canvas"
        description="SQL, Python, and visualizations on one infinite canvas. Build data pipelines and collaborate with your team."
        path={getPath('/home')}
      />
      <div className="marketing-theme bg-white">
        <main className="landing">
          {/* Hero Section */}
          <AnimatedSection className="section hero-section py-20 md:py-28" id="hero">
            <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-4xl w-full space-y-6">
                <p className="eyebrow text-wy-muted">{hero.eyebrow}</p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-wy-text leading-tight">
                  {hero.headline}
                </h1>
                <p className="text-lg md:text-xl text-wy-muted max-w-2xl mx-auto">
                  {hero.subheadline}
                </p>
                <div className="flex flex-wrap gap-3 justify-center hero-ctas">
                  <a className="btn primary" href={PRODUCT_SIGNUP_URL}>
                    {hero.ctas.primary}
                  </a>
                  <a className="btn secondary" href={PRODUCT_HOME_URL}>
                    {hero.ctas.secondary}
                  </a>
                </div>
                <p className="text-sm text-wy-muted">{hero.trust}</p>
              </div>
            </div>
          </AnimatedSection>

          {/* Trusted by */}
          <AnimatedSection className="section social-proof-section py-12 bg-wy-bg-subtle" id="trusted">
            <div className="section-inner text-center space-y-4">
              <p className="text-sm text-wy-muted uppercase tracking-wide">Trusted by data-driven teams</p>
              <div className="logo-row">
                {socialProofLogos.map((logo) => (
                  <span key={logo} className="text-wy-muted font-medium">
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Benefits */}
          <AnimatedSection className="section value-grid py-20 md:py-28" id="benefits">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">Why Workyy</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Everything you need in one place</h2>
              </div>
              <div className="cards-grid cards-grid-4">
                {valuePropsList.map((card, index) => (
                  <AnimatedCard key={card.title} delay={index * 60} className="card">
                    <h3 className="text-xl font-semibold text-wy-text mb-2">{card.title}</h3>
                    <p className="text-wy-muted">{card.description}</p>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* How it works */}
          <AnimatedSection className="section how-it-works py-20 md:py-28 bg-wy-bg-subtle" id="how-it-works">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">How it works</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Get started in four steps</h2>
              </div>
              <div className="cards-grid cards-grid-4">
                {howStepsList.map((step, index) => (
                  <AnimatedCard key={step.title} delay={index * 80} className="card text-center">
                    <span className="text-4xl mb-4 block" aria-hidden>
                      {step.icon}
                    </span>
                    <h3 className="text-xl font-semibold text-wy-text mb-2">{step.title}</h3>
                    <p className="text-wy-muted">{step.description}</p>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Features */}
          <AnimatedSection className="section feature-showcase py-20 md:py-28" id="features">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">Features</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Powerful tools for data teams</h2>
              </div>
              <div className="cards-grid cards-grid-2">
                {featureGroupsList.map((group, index) => (
                  <AnimatedCard key={group.title} delay={index * 60} className="card feature">
                    <h3 className="text-xl font-semibold text-wy-text mb-4">{group.title}</h3>
                    <ul className="space-y-2 text-sm text-wy-muted list-disc pl-5">
                      {group.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Use Cases / Personas */}
          <AnimatedSection className="section personas py-20 md:py-28 bg-wy-bg-subtle" id="personas">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">Built for</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Teams of all sizes</h2>
              </div>
              <div className="personas-grid">
                {personasList.map((persona, index) => (
                  <AnimatedCard key={persona.title} delay={index * 50} className="card">
                    <h3 className="text-xl font-semibold text-wy-text mb-2">{persona.title}</h3>
                    <p className="text-wy-muted">{persona.description}</p>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Pricing */}
          <AnimatedSection className="section pricing-teaser py-20 md:py-28" id="pricing">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">Pricing</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Plans that scale with your team</h2>
              </div>
              <div className="cards-grid pricing-grid">
                {pricingPlansList.map((plan, index) => (
                  <AnimatedCard key={plan.name} delay={index * 70} className="card space-y-4">
                    <div>
                      <p className="text-sm text-wy-muted mb-1">{plan.audience}</p>
                      <h3 className="text-2xl font-bold text-wy-text">{plan.name}</h3>
                    </div>
                    <ul className="list-disc pl-5 text-sm text-wy-muted space-y-2">
                      {plan.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </AnimatedCard>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-8">
                <a className="btn primary" href={getPath('/pricing')}>
                  {lang === 'en' ? 'See detailed pricing' : 'Подробные цены'}
                </a>
                <a className="btn secondary" href={getPath('/pricing')}>
                  {lang === 'en' ? 'Talk to sales' : 'Связаться с продажами'}
                </a>
              </div>
            </div>
          </AnimatedSection>

          {/* FAQ */}
          <AnimatedSection className="section faq py-20 md:py-28 bg-wy-bg-subtle" id="faq">
            <div className="section-inner">
              <div className="section-heading text-center mb-12">
                <p className="eyebrow text-wy-muted">FAQ</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-text">Common questions</h2>
              </div>
              <div className="faq-list max-w-3xl mx-auto">
                {faqsList.map((faq, index) => (
                  <AnimatedCard key={faq.question} delay={index * 60} className="card">
                    <h3 className="text-lg font-semibold text-wy-text mb-2">{faq.question}</h3>
                    <p className="text-sm text-wy-muted">{faq.answer}</p>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Final CTA */}
          <AnimatedSection className="section py-20 md:py-28" id="cta">
            <div className="section-inner">
              <div className="text-center max-w-2xl mx-auto space-y-6 bg-wy-primary rounded-2xl p-12 text-white">
                <h2 className="text-3xl md:text-4xl font-bold">
                  {lang === 'en' ? 'Ready to get started?' : 'Готовы начать?'}
                </h2>
                <p className="text-lg opacity-90">
                  {lang === 'en'
                    ? 'Start building your first board today. No credit card required.'
                    : 'Начните создавать свою первую доску сегодня. Без карты.'}
                </p>
                <a
                  className="inline-flex px-6 py-3 rounded-lg bg-white text-wy-primary font-semibold hover:bg-wy-bg-subtle transition-colors"
                  href={getPath('/pricing')}
                >
                  {lang === 'en' ? 'Start free trial' : 'Начать бесплатно'}
                </a>
              </div>
            </div>
          </AnimatedSection>
        </main>
      </div>
    </>
  )
}

export default HomePage
