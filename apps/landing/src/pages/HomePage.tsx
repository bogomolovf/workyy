import { useLanguage } from '../contexts/LanguageContext';
import { SEOHead } from '../components/SEOHead';
import { AnimatedSection } from '../components/ui/AnimatedSection';
import { AnimatedCard } from '../components/ui/AnimatedCard';
import { PRODUCT_HOME_URL } from '../config/appConfig';
import { BackgroundCursors } from '../components/BackgroundCursors';
import { CanvasDecorations } from '../components/CanvasDecorations';

const heroContent = {
  en: {
    eyebrow: 'Analytics Canvas',
    headline: 'SQL, Python, and visualizations on one infinite canvas',
    subheadline:
      'Build data pipelines, create visualizations, and collaborate with your team—all in one place.',
    ctas: {
      primary: 'Start for free',
      secondary: 'See demo boards',
    },
    trust: 'No credit card required',
  },
  ru: {
    eyebrow: 'Интерактивные доски для работы с данными',
    headline: 'SQL, python и визуализации на одной доске',
    subheadline:
    'Делайте SQL-выгрузки из баз данных, используйте python для обработки и стройте сложные визуализации с помощью встроенной BI-системы.',
    ctas: {
      primary: 'Попробовать бесплатно',
      secondary: 'Посмотреть демо-доски',
    },
    trust: 'Без карты',
  },
};

const socialProofLogos = [
  'Helios Pay',
  'Nuo Commerce',
  'Shenzhen Nebula Analytics',
  'Atlas Freight',
  'Bloomly Health',
  'Voltwave Gaming',
];

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
      title: 'Доски',
      description: 'В основе продукта бесконечная доска для рисования со всем необходимым функицоналом .',
    },
    {
      title: 'SQL + Python клетки',
      description: 'Загружайте данные, пишите код, визуализируйте и делайте выводы на основе данных.',
    },
    {
      title: 'Работа вместе',
      description: 'Используйте доску как единое пространство для работы вместе с командой, ставьте задачи и выполняйте их прямо на доске',
    },
    {
      title: 'Визуализации',
      description: 'Попробуйте нашу встроенную BI-систему, вам очень понравится...',
    },
  ],
};

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
};

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
      bullets: ['Ролевой доступ', 'Журналы аудита', 'Плановые обновления', 'Экспорт в PDF/PNG'],
    },
  ],
};

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
};

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
};

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
      answer:
        'Устанавливайте роли на доску (просмотр, комментарии, редактирование) и аудируйте взаимодействия.',
    },
    {
      question: 'Есть ли бесплатный пробный период?',
      answer: 'Starter бесплатен навсегда. Team и Pro включают 14-дневный пробный период.',
    },
    {
      question: 'Как работает коллаборация?',
      answer:
        'Многокурсорное редактирование, комментарии и обновления в реальном времени синхронизируют всех.',
    },
  ],
};

const HomePage = () => {
  const { language, content } = useLanguage();
  const lang = language as 'en' | 'ru';

  const getPath = (path: string) => `/${language}${path}`;

  const hero = heroContent[lang];
  const valuePropsList = valueProps[lang];
  const howStepsList = howSteps[lang];
  const featureGroupsList = featureGroups[lang];
  const personasList = personas[lang];
  const pricingPlansList = pricingPlans[lang];
  const faqsList = faqs[lang];
  
  // Контент из других страниц
  const productContent = content.product;
  const pricingContent = content.pricing;
  const useCasesContent = content.useCases;

  return (
    <>
      <SEOHead
        title="Workyy | Analytics Canvas"
        description="SQL, Python, and visualizations on one infinite canvas. Build data pipelines and collaborate with your team."
        path={getPath('/home')}
      />
      <div className="marketing-theme canvas-background" style={{ position: 'relative' }}>
        <BackgroundCursors />
        <CanvasDecorations />
        <main className="landing" style={{ position: 'relative', zIndex: 1 }}>
          {/* Hero Section */}
          <AnimatedSection className="section hero-section py-12 md:py-16" id="hero">
            <div className="w-full flex justify-center px-4 sm:px-4 lg:px-6">
              <div className="text-center max-w-6xl w-full space-y-4 md:space-y-5">
                <p className="eyebrow text-wy-primary font-semibold">{hero.eyebrow}</p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-wy-primary leading-tight">
                  {hero.headline}
                </h1>
                <p className="text-lg md:text-xl text-wy-muted max-w-2xl mx-auto">
                  {hero.subheadline}
                </p>
              </div>
            </div>
          </AnimatedSection>

          {/* Trusted by */}
          <AnimatedSection
            className="section social-proof-section py-12 md:py-16"
            id="trusted"
          >
            <div className="section-inner">
              <div className="text-center mb-8 md:mb-10">
                <p className="text-xs md:text-sm text-wy-muted font-medium uppercase tracking-wider mb-3">
                  Кто уже внедрил workyy в свой рабочий процесс
                </p>
                <h3 className="text-base md:text-lg font-semibold text-wy-text">
                  Наши клиенты:
                </h3>
              </div>
              <div className="logo-marquee-wrapper">
                <div className="logo-marquee-container">
                  <div className="logo-marquee">
                    {/* Первый набор логотипов */}
                    {socialProofLogos.map((logo, index) => (
                      <div key={`first-${index}`} className="logo-item">
                        <span className="logo-text">{logo}</span>
                      </div>
                    ))}
                    {/* Дублируем для бесшовной анимации */}
                    {socialProofLogos.map((logo, index) => (
                      <div key={`second-${index}`} className="logo-item">
                        <span className="logo-text">{logo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Product Section */}
          <AnimatedSection className="section product-section py-12 md:py-16" id="product">
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Продукт</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">
                  Всё необходимое для работы с данными
                </h2>
              </div>
              <div className="cards-grid cards-grid-3">
                <AnimatedCard delay={0} className="card">
                  <h3 className="text-xl font-semibold text-wy-text mb-3">{productContent.canvas.title}</h3>
                  <p className="text-wy-muted mb-4">{productContent.canvas.description}</p>
                </AnimatedCard>
                <AnimatedCard delay={60} className="card">
                  <h3 className="text-xl font-semibold text-wy-text mb-3">{productContent.collaboration.title}</h3>
                  <p className="text-wy-muted mb-4">{productContent.collaboration.description}</p>
                </AnimatedCard>
                <AnimatedCard delay={120} className="card">
                  <h3 className="text-xl font-semibold text-wy-text mb-3">{productContent.performance.title}</h3>
                  <p className="text-wy-muted mb-4">{productContent.performance.description}</p>
                </AnimatedCard>
              </div>
            </div>
          </AnimatedSection>

          {/* Benefits */}
          <AnimatedSection className="section value-grid py-12 md:py-16" id="benefits">
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Почему Workyy</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">
                  Всё что нужно. В браузере. Без установки.
                </h2>
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

          {/* Use Cases / Personas */}
          <AnimatedSection
            className="section personas py-12 md:py-16"
            id="personas"
          >
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Создано для</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">Команд любого размера</h2>
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

          {/* Use Cases Section */}
          <AnimatedSection className="section use-cases-section py-12 md:py-16" id="use-cases">
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Варианты использования</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">
                  Решения для разных задач
                </h2>
              </div>
              <div className="cards-grid cards-grid-3">
                {Object.entries(useCasesContent).map(([key, useCase], index) => (
                  <AnimatedCard key={key} delay={index * 60} className="card">
                    <h3 className="text-xl font-semibold text-wy-text mb-3">{useCase.title}</h3>
                    <p className="text-wy-muted">{useCase.description}</p>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Pricing */}
          <AnimatedSection className="section pricing-teaser py-12 md:py-16" id="pricing">
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Цены</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">
                  {pricingContent.title}
                </h2>
                <p className="text-wy-muted mt-4 max-w-2xl mx-auto">{pricingContent.description}</p>
              </div>
              <div className="pricing-grid-container">
                {pricingContent.plans.map((plan, index) => (
                  <AnimatedCard key={plan.name} delay={index * 70} className={`card space-y-4 ${plan.highlight ? 'ring-2 ring-wy-primary' : ''}`}>
                    <div>
                      <h3 className="text-2xl font-bold text-wy-text mb-2">{plan.name}</h3>
                      <p className="text-lg font-semibold text-wy-primary mb-4">{plan.price}</p>
                    </div>
                    <ul className="list-disc pl-5 text-sm text-wy-muted space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </AnimatedCard>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* FAQ */}
          <AnimatedSection className="section faq py-12 md:py-16" id="faq">
            <div className="section-inner">
              <div className="section-heading text-center mb-8 md:mb-10">
                <p className="eyebrow text-wy-primary font-semibold">Часто задаваемые вопросы</p>
                <h2 className="text-3xl md:text-4xl font-bold text-wy-primary">Частые вопросы</h2>
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

        </main>
      </div>
    </>
  );
};

export default HomePage;
