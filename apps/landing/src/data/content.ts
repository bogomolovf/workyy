export type Language = 'en' | 'ru';

export interface Content {
  home: {
    hero: {
      tagline: string;
      title: string;
      description: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    benefits: Array<{
      title: string;
      description: string;
      icon: string;
    }>;
    analyticsForEveryone: {
      title: string;
      subtitle: string;
      description: string;
      columns: Array<{
        title: string;
        tagline: string;
        body: string;
      }>;
    };
    features: {
      title: string;
      subtitle: string;
      categories: Array<{
        heading: string;
        catchphrase: string;
        description: string;
        bullets: string[];
      }>;
    };
    mix: {
      title: string;
      subtitle: string;
      description: string;
      points: string[];
    };
    playground: {
      title: string;
      subtitle: string;
      description: string;
      games: Array<{
        title: string;
        description: string;
        detail: string;
        icon: string;
      }>;
    };
    design: {
      title: string;
      subtitle: string;
      description: string;
      highlights: Array<{
        title: string;
        description: string;
      }>;
    };
    future: {
      title: string;
      description: string;
      highlights: Array<{
        title: string;
        detail: string;
      }>;
      cta: string;
    };
  };
  product: {
    canvas: {
      title: string;
      description: string;
      cta: string;
    };
    collaboration: {
      title: string;
      description: string;
      cta: string;
    };
    performance: {
      title: string;
      description: string;
      cta: string;
    };
  };
  pricing: {
    title: string;
    description: string;
    plans: Array<{
      name: string;
      price: string;
      features: string[];
      cta: string;
      highlight: boolean;
    }>;
    contactCta: string;
  };
  useCases: {
    [key: string]: {
      title: string;
      description: string;
      cta: string;
    };
  };
  compare: {
    [key: string]: {
      title: string;
      description: string;
      cta: string;
    };
  };
  integrations: {
    [key: string]: {
      title: string;
      description: string;
    };
  };
  resources: {
    [key: string]: {
      title: string;
      description: string;
    };
  };
  changelog: {
    title: string;
    description: string;
  };
  roadmap: {
    title: string;
    description: string;
  };
  footer: {
    brandTitle: string;
    brandDescription: string;
    product: {
      title: string;
      canvas: string;
      collaboration: string;
      performance: string;
      pricing: string;
      changelog: string;
      roadmap: string;
    };
    useCases: {
      title: string;
      dataAnalysis: string;
      selfServe: string;
      reporting: string;
      dataModeling: string;
      productAnalytics: string;
      financeOps: string;
    };
    compare: {
      title: string;
      classicBi: string;
      notebooks: string;
      smallTeams: string;
      startups: string;
    };
    integrations: {
      title: string;
      postgres: string;
      snowflake: string;
      bigquery: string;
      mysql: string;
      csvFiles: string;
    };
    resources: {
      title: string;
      security: string;
      privacy: string;
      terms: string;
    };
  };
}

export const content: Record<Language, Content> = {
  en: {
    home: {
      hero: {
        tagline: 'Workyy',
        title: 'Business Analytics for Everyone.',
        description:
          'Workyy is a collaborative analytics platform that combines the power of notebooks with the simplicity of BI tools. On a flexible canvas, teams can run live SQL or Python, build charts, and add insights side-by-side. No more switching between code, spreadsheets, and dashboard tools – Workyy unifies everything in one place.',
        ctaPrimary: 'Try Workyy for free today',
        ctaSecondary: 'View Canvas',
      },
      benefits: [
        {
          title: 'No-Code & Pro-Code',
          description: 'Use a friendly UI or dive into SQL/Python when needed.',
          icon: '🧩',
        },
        {
          title: 'Interactive Canvas',
          description: 'Drag, drop, and rearrange anything – your dashboard is a blank canvas.',
          icon: '🖼️',
        },
        {
          title: 'Built for Everyone',
          description: 'Simple for beginners, powerful for experts.',
          icon: '🤝',
        },
        {
          title: 'Real-Time Results',
          description: 'Run code and see visualizations update instantly.',
          icon: '⚡',
        },
      ],
      analyticsForEveryone: {
        title: 'Analytics for Everyone',
        subtitle: 'Empower Every User',
        description:
          "Workyy bridges the gap between non-technical users and coders. Whether you're a business analyst, a manager, or a seasoned data scientist, Workyy provides a space where anyone can explore data and build insights.",
        columns: [
          {
            title: 'Easy for Beginners',
            tagline: 'If you can use a whiteboard, you can use Workyy.',
            body: 'Beginners can start by dragging in data, using the visual tools, and adding notes – no steep learning curve.',
          },
          {
            title: 'Powerful for Experts',
            tagline: "Under the hood, it's a serious data workstation.",
            body: 'Experienced users have all the advanced tools they need. Coders can write complex SQL queries or Python scripts, connect to databases, and use their favorite libraries.',
          },
          {
            title: 'Collaborative & Shareable',
            tagline: 'Skip the email back-and-forth.',
            body: "Results can be easily shared with team members or stakeholders. Workyy's approach enables collaborative analysis on a canvas that everyone can view and comment on.",
          },
        ],
      },
      features: {
        title: 'What You Can Do with Workyy',
        subtitle: 'Features at a Glance',
        categories: [
          {
            heading: 'Interactive Canvas',
            catchphrase: 'Your Analysis, Your Way',
            description:
              "Workyy provides a flexible canvas where you can place anything anywhere. Unlike rigid BI dashboards, you're free to drag and arrange components as you see fit.",
            bullets: [
              'Freeform positioning and resizing of blocks',
              'Code cell + visualization + text in one frame',
              'Drawing and highlighting important points directly on the canvas',
            ],
          },
          {
            heading: 'Coding Environment',
            catchphrase: 'Code When You Need It',
            description:
              'SQL and Python cells are side by side, allowing you to mix queries, scripts, and visual elements.',
            bullets: [
              'Run queries to connected databases or uploaded CSV files',
              'Python for transformations, libraries, and modeling',
              'Outputs appear immediately below the cell – tables, charts, output',
            ],
          },
          {
            heading: 'Organization & Save',
            catchphrase: 'Projects at a Glance',
            description:
              'The home page stores all boards, and snapshots save the state of any analytics session.',
            bullets: [
              'Create a new board with one click',
              'Save and continue from the same cell arrangement',
              'Delete or edit any element without fear of making mistakes',
            ],
          },
          {
            heading: 'Annotations & Notes',
            catchphrase: 'Annotate Your Insights',
            description:
              'Digital sticky notes and notes keep context next to data, and drawings emphasize conclusions.',
            bullets: [
              'Colorful sticky notes for hypotheses, tasks, and statuses',
              'Free labels and arrows to explain trends',
              'Planning tags and mentions of colleagues directly in notes',
            ],
          },
        ],
      },
      mix: {
        title: 'The Perfect Mix – Code + Dashboard = Workyy',
        subtitle: 'Where Coding Meets Creativity',
        description:
          'No more jumping between your SQL editor, Jupyter notebook, and BI tool – with Workyy, you get it all on one screen.',
        points: [
          'Code, visualizations, and notes are positioned side by side',
          'Iterations accelerate: think it – make it – see it, instantly',
          'Share the board and show the complete thought process',
        ],
      },
      playground: {
        title: 'Workyy Playground',
        subtitle: 'Test Your Data Skills – Play & Learn',
        description:
          "Workyy isn't just about work – it's also about engaging users to think analytically in a fun way.",
        games: [
          {
            title: 'Insight Tarot',
            description: 'Want to relax and see your future?',
            detail: 'Draw three cards "Past / Present / Future" and get a fun analytical tip.',
            icon: '🔮',
          },
        ],
      },
      design: {
        title: 'Design & User Experience – Aurora Inspired Interface',
        subtitle: 'A Dazzling yet Comforting UI',
        description:
          "Workyy's default theme draws inspiration from the Aurora Borealis. The background is a midnight blue – a dark, calming backdrop like a night sky.",
        highlights: [
          {
            title: 'Northern Lights Palette',
            description:
              'Vibrant accents of green and complementary hues of teal, purple, and soft blue mimic the glowing ribbons of an aurora.',
          },
          {
            title: 'Glow for Focus',
            description:
              'Buttons and active elements glow with green light – like a flash of aurora in the tundra.',
          },
          {
            title: 'Optional Themes',
            description: 'Switch to a light or neutral theme – "your data, your style".',
          },
        ],
      },
      future: {
        title: 'Future Outlook and Closing CTA',
        description: 'Workyy is continuously evolving. Many more functions are on the horizon.',
        highlights: [
          {
            title: 'Collaborative Real-Time Editing',
            detail: 'Work on the canvas in real time, comments, and access roles.',
          },
          {
            title: 'AI-Assisted Insights',
            detail:
              'Minute summaries, presentation generation, and recommendations for next steps.',
          },
          {
            title: 'Extended Integrations',
            detail: 'New connectors, automatic updates, and source catalogs.',
          },
        ],
        cta: 'Transform the way you work with data – with Workyy, your next big insight is just a drag, drop, or query away.',
      },
    },
    product: {
      canvas: {
        title: 'The Canvas',
        description:
          "The Canvas is Workyy's core workspace – a flexible, infinite page where you can build analyses freely. Drag and drop data blocks, live SQL/Python cells, charts, and even sticky notes anywhere to organize your insights. The Canvas lets you design a custom flow of data and visuals that fits your thinking, instead of forcing you into a predefined grid.",
        cta: 'Create your first Canvas now and explore your data in a whole new way.',
      },
      collaboration: {
        title: 'Collaboration',
        description:
          "Workyy is built for teamwork. Multiple team members can edit the same canvas at once and see each other's updates in real time. Add context by commenting directly on any chart, query, or note, and tag colleagues to bring them into the discussion. All changes are saved with version history, so you can always review or revert anything and see who made each edit.",
        cta: 'Invite your team and start collaborating on data like never before.',
      },
      performance: {
        title: 'Performance',
        description:
          "Fast and scalable by design. Workyy's architecture is optimized to handle big data and complex calculations without breaking a sweat. It connects directly to your databases and data warehouses, pushing heavy computations to those powerful engines for maximum speed.",
        cta: "Experience Workyy's speed on your own data today.",
      },
    },
    pricing: {
      title: 'Pricing',
      description:
        "Flexible plans for any team. Whether you're a small startup or a large enterprise, Workyy has a plan that fits.",
      plans: [
        {
          name: 'Free',
          price: 'Free forever',
          features: [
            'Unlimited canvases',
            'Core features',
            'Secure connections',
            'Community support',
          ],
          cta: 'Get Started',
          highlight: false,
        },
        {
          name: 'Pro',
          price: 'From $49/month',
          features: [
            'Everything in Free',
            'Advanced collaboration',
            'Priority support',
            'Custom integrations',
          ],
          cta: 'Start Free Trial',
          highlight: true,
        },
        {
          name: 'Enterprise',
          price: 'Custom pricing',
          features: [
            'Everything in Pro',
            'Dedicated support',
            'SLA guarantee',
            'Custom deployment',
          ],
          cta: 'Contact Sales',
          highlight: false,
        },
      ],
      contactCta: 'Contact for demo',
    },
    useCases: {
      'data-analysis': {
        title: 'Data Analysis',
        description:
          "For exploratory data analysis and deep dives, Workyy is an analyst's dream. Connect multiple data sources and freely explore them with SQL queries or even Python for advanced statistics and modeling.",
        cta: 'Try Workyy for data analysis and accelerate your insights.',
      },
      'self-serve': {
        title: 'Self-Serve Analytics',
        description:
          'Empower your non-technical teams with self-serve analytics. Workyy makes it easy for business users to answer their own data questions without writing a single line of code.',
        cta: 'Enable your team with self-service analytics in Workyy.',
      },
      reporting: {
        title: 'Reporting',
        description:
          'Streamline your reporting workflows. With Workyy, you can build live reports and dashboards that update automatically with the latest data – no more manual exports or static slide decks.',
        cta: 'Simplify your reporting with always-current dashboards in Workyy.',
      },
      'data-modeling': {
        title: 'Data Modeling',
        description:
          'Define your data once and reuse it everywhere. Workyy supports data modeling to maintain a single source of truth for your metrics and business logic.',
        cta: 'Maintain one source of truth by modeling your data with Workyy.',
      },
      'product-analytics': {
        title: 'Product Analytics',
        description:
          "Understand your user journey with Workyy's product analytics capabilities. Whether you're tracking sign-up funnels, feature adoption, or retention cohorts, Workyy lets you bring all your product data together for analysis.",
        cta: "Explore your user data with Workyy's product analytics.",
      },
      'finance-ops': {
        title: 'Finance & Ops',
        description:
          "Keep a pulse on your business's financial and operational health. Workyy helps finance and ops teams consolidate data from spreadsheets, databases, and SaaS tools into one unified view.",
        cta: 'Unify your numbers with Workyy for finance and ops insights.',
      },
    },
    compare: {
      'classic-bi': {
        title: 'Workyy vs. Classic BI',
        description:
          'Traditional BI tools excel at standardized reporting and visuals for business users, but they can be inflexible and slow to adapt. Workyy offers a more agile approach without sacrificing ease-of-use.',
        cta: 'Move beyond legacy BI – bring your analytics to Workyy for a modern experience.',
      },
      notebooks: {
        title: 'Workyy vs. Notebooks',
        description:
          'Data science notebooks are loved by technical analysts for their flexibility and power. Workyy incorporates the best of notebooks (live code execution, rich analysis) into a team-friendly platform.',
        cta: 'Combine code and collaboration with Workyy instead of isolated notebooks.',
      },
      'small-teams': {
        title: 'Workyy for Small Teams',
        description:
          'Small teams often rely on spreadsheets and ad-hoc tools because traditional BI feels too heavy or costly. Workyy provides a perfect middle ground.',
        cta: 'Upgrade from spreadsheets – give your small team the power of Workyy.',
      },
      startups: {
        title: 'Workyy for Startups',
        description:
          "Startups move fast and can't afford to spend months setting up a complex data stack. Workyy offers a quick-to-deploy analytics platform that grows with you.",
        cta: "Accelerate your startup with Workyy's ready-to-go analytics.",
      },
    },
    integrations: {
      postgres: {
        title: 'PostgreSQL',
        description:
          'Workyy connects directly to PostgreSQL databases in minutes. Whether your Postgres is hosted on AWS, Azure, or on-prem, simply provide your connection details and start running queries.',
      },
      snowflake: {
        title: 'Snowflake',
        description:
          "Workyy seamlessly integrates with Snowflake, letting you leverage Snowflake's cloud data warehouse power. Just enter your Snowflake credentials and connect – Workyy will query data directly from your Snowflake warehouses.",
      },
      bigquery: {
        title: 'BigQuery',
        description:
          'Workyy has native support for Google BigQuery. Connect your BigQuery project to Workyy via your Google Cloud credentials, and you can run SQL on your BigQuery datasets right from the canvas.',
      },
      mysql: {
        title: 'MySQL',
        description:
          'Workyy integrates with MySQL databases as well, so you can include data from legacy systems or open-source databases in your analysis.',
      },
      csv: {
        title: 'CSV & Files',
        description:
          'Not all data lives in databases. Workyy lets you import CSVs and other flat files so you can analyze spreadsheet data too.',
      },
    },
    resources: {
      security: {
        title: 'Security',
        description:
          "Your data's security is our top priority. Workyy employs enterprise-grade security measures to protect your information at every layer.",
      },
      privacy: {
        title: 'Privacy Policy',
        description:
          'Review our Privacy Policy to understand how we collect, use, and protect your personal data. Workyy is committed to user privacy – we collect only the information needed to provide and improve our service.',
      },
      terms: {
        title: 'Terms of Use',
        description:
          'Please read our Terms of Use, which is the legal agreement governing your use of Workyy. The Terms of Use explain the rights and responsibilities of you (the user) and Workyy.',
      },
    },
    changelog: {
      title: 'Changelog',
      description:
        "Workyy is continuously evolving. Our Changelog page lists all new features, improvements, and fixes as soon as they're released.",
    },
    roadmap: {
      title: 'Roadmap',
      description:
        "See what's coming next. Our Roadmap offers a transparent view of the features and improvements we plan to implement in Workyy.",
    },
    footer: {
      brandTitle: 'Workyy',
      brandDescription:
        'Mixed SQL and Python nodes, DAG and collaborative analytics on one canvas.',
      product: {
        title: 'PRODUCT',
        canvas: 'The Canvas',
        collaboration: 'Collaboration',
        performance: 'Performance',
        pricing: 'Pricing',
        changelog: 'Changelog',
        roadmap: 'Roadmap',
      },
      useCases: {
        title: 'USE CASES',
        dataAnalysis: 'Data analysis',
        selfServe: 'Self-serve analytics',
        reporting: 'Reporting',
        dataModeling: 'Data modeling',
        productAnalytics: 'Product analytics',
        financeOps: 'Finance & Ops',
      },
      compare: {
        title: 'COMPARE',
        classicBi: 'Workyy vs Classic BI',
        notebooks: 'Workyy vs Notebooks',
        smallTeams: 'Workyy for Small Teams',
        startups: 'Workyy for Startups',
      },
      integrations: {
        title: 'INTEGRATIONS',
        postgres: 'Postgres',
        snowflake: 'Snowflake',
        bigquery: 'BigQuery',
        mysql: 'MySQL',
        csvFiles: 'CSV / files',
      },
      resources: {
        title: 'RESOURCES',
        security: 'Security',
        privacy: 'Privacy Policy',
        terms: 'Terms of Use',
      },
    },
  },
  ru: {
    home: {
      hero: {
        tagline: 'Workyy',
        title: 'Бизнес-аналитика для всех.',
        description:
          'Workyy — это совместная платформа аналитики, сочетающая возможности аналитических блокнотов с простотой BI-инструментов. На гибком холсте команды могут в реальном времени выполнять SQL- и Python-запросы, создавать диаграммы и добавлять инсайты бок о бок.',
        ctaPrimary: 'Попробуйте Workyy бесплатно уже сегодня',
        ctaSecondary: 'Посмотреть канву',
      },
      benefits: [
        {
          title: 'No-Code & Pro-Code',
          description: 'Используйте дружелюбный UI или прыгайте в SQL/Python, когда нужна глубина.',
          icon: '🧩',
        },
        {
          title: 'Interactive Canvas',
          description:
            'Перетаскивайте блоки, чертите связи и стройте сторилайн свободно, без сетки.',
          icon: '🖼️',
        },
        {
          title: 'Built for Everyone',
          description:
            'От аналитиков до продактов — Workyy равноправно относится к любому стилю работы.',
          icon: '🤝',
        },
        {
          title: 'Real-Time Results',
          description: 'Запускайте код и мгновенно обновляйте визуализации прямо на канве.',
          icon: '⚡',
        },
      ],
      analyticsForEveryone: {
        title: 'Аналитика для всех',
        subtitle: 'Empower Every User',
        description:
          'Workyy соединяет тех, кто предпочитает визуальные инструменты, с теми, кто живёт в коде. Один холст — разные стили мышления.',
        columns: [
          {
            title: 'Инклюзивность',
            tagline: 'If you can use a whiteboard, you can use Workyy.',
            body: 'Перетащите данные, добавьте заметки, соберите графики кликом. Никаких сложных меню — только интуитивный визуальный язык.',
          },
          {
            title: 'Серьёзная мощь',
            tagline: "Under the hood, it's a serious data workstation.",
            body: 'Пишите сложные SQL-запросы и Python-скрипты, подключайте базы и любимые библиотеки. Workyy — это ноутбук и BI одновременно.',
          },
          {
            title: 'Совместная канва',
            tagline: 'Skip the email back-and-forth.',
            body: 'Делитесь досками, добавляйте подсветки и комментарии, чтобы вся команда видела ход мысли на одном холсте.',
          },
        ],
      },
      features: {
        title: 'Что можно делать с Workyy',
        subtitle: 'Features at a Glance',
        categories: [
          {
            heading: 'Interactive Canvas',
            catchphrase: 'Your Analysis, Your Way',
            description:
              'Свободно размещайте код, графики, заметки и рисунки. Превратите данные в историю с нарративным расположением.',
            bullets: [
              'Свободное позиционирование и изменение размеров блоков',
              'Комбинация код-ячейка + визуализация + текст в одном кадре',
              'Рисование и выделение важных точек прямо поверх канвы',
            ],
          },
          {
            heading: 'Coding Environment',
            catchphrase: 'Code When You Need It',
            description:
              'SQL и Python клетки находятся рядом, позволяя смешивать запросы, скрипты и визуальные элементы.',
            bullets: [
              'Запускайте запросы к подключённым базам или загруженным CSV',
              'Python для трансформаций, библиотек и моделирования',
              'Выводы появляются сразу под клеткой — таблицы, графики, вывод',
            ],
          },
          {
            heading: 'Organization & Save',
            catchphrase: 'Projects at a Glance',
            description:
              'Домашняя страница хранит все доски, а снапшоты сохраняют состояние любой аналитической сессии.',
            bullets: [
              'Создание новой доски в один клик',
              'Сохранение и продолжение с того же расположения ячеек',
              'Удаление или редактирование любого элемента без страха ошибиться',
            ],
          },
          {
            heading: 'Annotations & Notes',
            catchphrase: 'Annotate Your Insights',
            description:
              'Цифровые стикеры и заметки удерживают контекст рядом с данными, а рисунки подчёркивают выводы.',
            bullets: [
              'Цветные стикеры для гипотез, задач и статусов',
              'Свободные подписи и стрелки для объяснения трендов',
              'Планируем теги и упоминания коллег прямо в заметках',
            ],
          },
        ],
      },
      mix: {
        title: 'Идеальный микс — Code + Dashboard = Workyy',
        subtitle: 'Where Coding Meets Creativity',
        description:
          'Больше никаких переключений между SQL-редактором, ноутбуком и BI-дешбордом: Workyy объединяет всё на одном экране.',
        points: [
          'Code, визуализации и заметки располагаются рядом',
          'Итерации ускоряются: подумали — написали — увидели',
          'Делитесь доской и показывайте путь мысли целиком',
        ],
      },
      playground: {
        title: 'Workyy Playground',
        subtitle: 'Игровые мини-песочницы',
        description:
          'Разогрейте аналитическое мышление: мини-игры демонстрируют, как Workyy помогает экспериментировать с данными.',
        games: [
          {
            title: 'Insight Tarot',
            description: 'Хотите расслабиться и увидеть своё будущее?',
            detail:
              'Лёгкая игра, которая показывает, как Workyy помогает думать по временной шкале.',
            icon: '🔮',
          },
        ],
      },
      design: {
        title: 'Дизайн и UX — интерфейс в стиле Aurora',
        subtitle: 'A Dazzling yet Comforting UI',
        description:
          'Фон в цветах полярного сияния: тёмный космос с зелёными и пурпурными лучами создаёт вдохновение и контраст.',
        highlights: [
          {
            title: 'Northern Lights Palette',
            description:
              'Неоновые акценты зелёного и дополнительные оттенки бирюзы, фиолетового и мягкого синего имитируют светящиеся ленты сияния.',
          },
          {
            title: 'Glow for Focus',
            description:
              'Кнопки и активные элементы подсвечиваются зелёным свечением — как вспышка сияния в тундре.',
          },
          {
            title: 'Optional Themes',
            description:
              'Переключайтесь на светлую или нейтральную тему — «your data, your style».',
          },
        ],
      },
      future: {
        title: 'Будущее и финальный CTA',
        description: 'Workyy постоянно развивается. Многие функции уже в разработке.',
        highlights: [
          {
            title: 'Совместное редактирование',
            detail: 'Работа над канвой в реальном времени, комментарии и роли доступа.',
          },
          {
            title: 'AI-подсказки',
            detail: 'Минутные резюме, генерация презентаций и рекомендации следующих шагов.',
          },
          {
            title: 'Расширенные интеграции',
            detail: 'Новые коннекторы, автоматические обновления и каталоги источников.',
          },
        ],
        cta: 'Преобразуйте способ работы с данными — с Workyy ваш следующий большой инсайт всего в перетаскивании, капле или запросе.',
      },
    },
    product: {
      canvas: {
        title: 'Canvas',
        description:
          'Canvas — основной рабочий пространствор Workyy: гибкое, бесконечное полотно, на котором вы можете свободно проводить анализ данных. Перетаскивайте на холст блоки данных, живые SQL/Python-ячейки с кодом, диаграммы и даже стикеры с заметками, располагая их как угодно для организации инсайтов.',
        cta: 'Создайте свой первый Canvas уже сейчас и откройте для себя новый подход к анализу данных.',
      },
      collaboration: {
        title: 'Collaboration',
        description:
          'Workyy создан для командной работы. Несколько членов команды могут одновременно редактировать один и тот же холст, видя правки друг друга в реальном времени.',
        cta: 'Пригласите свою команду и начните работать с данными вместе, как никогда прежде.',
      },
      performance: {
        title: 'Performance',
        description:
          'Быстродействие и масштабируемость заложены в Workyy с самого начала. Платформа напрямую подключается к вашим базам данных и облачным хранилищам, перекладывая тяжелые вычисления на их мощные движки для максимальной скорости.',
        cta: 'Оцените скорость Workyy на своих данных уже сегодня.',
      },
    },
    pricing: {
      title: 'Pricing',
      description:
        'Гибкие тарифы для любой команды. Независимо от того, являетесь ли вы стартапом или крупным предприятием, у Workyy найдется подходящий план.',
      plans: [
        {
          name: 'Free',
          price: 'Бесплатно навсегда',
          features: [
            'Неограниченные холсты',
            'Основные функции',
            'Безопасные подключения',
            'Поддержка сообщества',
          ],
          cta: 'Начать',
          highlight: false,
        },
        {
          name: 'Pro',
          price: 'От $49/мес',
          features: [
            'Всё из Free',
            'Расширенная коллаборация',
            'Приоритетная поддержка',
            'Кастомные интеграции',
          ],
          cta: 'Начать пробный период',
          highlight: true,
        },
        {
          name: 'Enterprise',
          price: 'Индивидуальная цена',
          features: [
            'Всё из Pro',
            'Выделенная поддержка',
            'Гарантия SLA',
            'Кастомное развёртывание',
          ],
          cta: 'Связаться с продажами',
          highlight: false,
        },
      ],
      contactCta: 'Связаться для демо',
    },
    useCases: {
      'data-analysis': {
        title: 'Data Analysis',
        description:
          'Для исследовательского анализа данных Workyy – настоящая находка для аналитика. Подключайте несколько источников данных и свободно изучайте их с помощью SQL-запросов или даже Python для продвинутой статистики и моделирования.',
        cta: 'Попробуйте Workyy для анализа данных и ускорьте получение инсайтов.',
      },
      'self-serve': {
        title: 'Self-Serve Analytics',
        description:
          'Дайте возможность вашим сотрудникам самостоятельно получать аналитические данные. Workyy упрощает бизнес-пользователям поиск ответов на вопросы по данным без единой строчки кода.',
        cta: 'Дайте вашей команде инструмент самостоятельной аналитики с Workyy.',
      },
      reporting: {
        title: 'Reporting',
        description:
          'Сделайте подготовку отчетов простой и автоматизированной. С Workyy вы можете создавать интерактивные отчеты и панели, которые автоматически обновляются актуальными данными.',
        cta: 'Упростите вашу отчетность с помощью всегда актуальных дашбордов в Workyy.',
      },
      'data-modeling': {
        title: 'Data Modeling',
        description:
          'Определите логику данных один раз и используйте ее повсеместно. Workyy поддерживает моделирование данных, помогая поддерживать единый источник истины для метрик и бизнес-логики.',
        cta: 'Поддерживайте единый источник истины, моделируя данные в Workyy.',
      },
      'product-analytics': {
        title: 'Product Analytics',
        description:
          'Получите полное представление о поведении пользователей с аналитикой продукта в Workyy. От анализа воронок регистрации и использования функций до когорт удержания – Workyy позволяет собрать все продуктовые данные для комплексного анализа.',
        cta: 'Анализируйте пользовательские данные с продуктовой аналитикой Workyy.',
      },
      'finance-ops': {
        title: 'Finance & Ops',
        description:
          'Держите руку на пульсе финансового и операционного состояния бизнеса. Workyy помогает финансовым и операционным командам объединить данные из таблиц, баз данных и облачных сервисов в едином представлении.',
        cta: 'Объедините ваши показатели в Workyy, чтобы получить полную картину по финансам и операциям.',
      },
    },
    compare: {
      'classic-bi': {
        title: 'Workyy vs. Classic BI',
        description:
          'Классические BI-инструменты отлично подходят для стандартизированной отчетности и визуализации, но часто бывают негибкими и медленно реагируют на новые запросы. Workyy обеспечивает более гибкий подход, не жертвуя удобством.',
        cta: 'Перейдите от устаревшего BI к Workyy и получите современную аналитику.',
      },
      notebooks: {
        title: 'Workyy vs. Notebooks',
        description:
          'Аналитические блокноты ценятся специалистами за гибкость и мощность – в них можно выполнить сложный код для анализа. Workyy берет лучшее от блокнотов и переносит это в платформу, удобную для команды.',
        cta: 'Объедините возможности кода и совместной работы в Workyy вместо изолированных блокнотов.',
      },
      'small-teams': {
        title: 'Workyy для маленьких команд',
        description:
          'Небольшие команды часто полагаются на электронные таблицы и разрозненные инструменты, потому что традиционные BI-системы кажутся слишком сложными или дорогими. Workyy предлагает идеальное решение промежуточного уровня.',
        cta: 'Откажитесь от одних только таблиц – дайте вашей команде мощь Workyy.',
      },
      startups: {
        title: 'Workyy для стартапов',
        description:
          'Стартапы развиваются быстро и не могут позволить себе тратить месяцы на разворачивание сложного стека аналитики. Workyy предлагает готовую аналитическую платформу, которую можно запустить мгновенно и масштабировать вместе с ростом компании.',
        cta: 'Ускорьте развитие своего стартапа с помощью готовой аналитической платформы Workyy.',
      },
    },
    integrations: {
      postgres: {
        title: 'PostgreSQL',
        description:
          'Workyy напрямую подключается к базам данных PostgreSQL всего за несколько минут. Независимо от того, развернута ли ваша Postgres-база в AWS, Azure или локально, достаточно указать параметры подключения, и можно сразу выполнять запросы.',
      },
      snowflake: {
        title: 'Snowflake',
        description:
          'Workyy легко интегрируется с платформой Snowflake, позволяя вам использовать всю мощь этого облачного хранилища данных. Просто введите учетные данные Snowflake – Workyy напрямую выполняет запросы к вашим данным в Snowflake.',
      },
      bigquery: {
        title: 'BigQuery',
        description:
          'Workyy изначально поддерживает интеграцию с Google BigQuery. Подключите свой проект BigQuery к Workyy через учетные данные Google Cloud, и вы сможете выполнять SQL-запросы к датасетам BigQuery прямо на холсте.',
      },
      mysql: {
        title: 'MySQL',
        description:
          'Workyy также умеет подключаться к базам данных MySQL, поэтому вы можете включить в анализ данные из legacy-систем или популярных open-source СУБД.',
      },
      csv: {
        title: 'CSV & Files',
        description:
          'Не все данные хранятся в базах. Workyy позволяет импортировать CSV и другие файлы с данными, так что вы можете анализировать даже информацию из таблиц.',
      },
    },
    resources: {
      security: {
        title: 'Security',
        description:
          'Безопасность ваших данных – наш главный приоритет. Workyy использует защитные меры корпоративного уровня, чтобы оберегать вашу информацию на всех уровнях.',
      },
      privacy: {
        title: 'Privacy Policy',
        description:
          'Ознакомьтесь с нашей Политикой конфиденциальности, чтобы понять, как мы собираем, используем и защищаем ваши персональные данные. Workyy придерживается принципов приватности пользователей.',
      },
      terms: {
        title: 'Terms of Use',
        description:
          'Пожалуйста, ознакомьтесь с нашими Условиями использования – это юридическое соглашение, регулирующее ваше использование платформы Workyy.',
      },
    },
    changelog: {
      title: 'Changelog',
      description:
        'Workyy постоянно развивается. На странице «Changelog» перечислены все новые функции, улучшения и исправления по мере их выхода.',
    },
    roadmap: {
      title: 'Roadmap',
      description:
        'Узнайте, что впереди. Наш Roadmap (план развития) предоставляет прозрачный обзор функций и улучшений, которые мы планируем внедрить в Workyy.',
    },
    footer: {
      brandTitle: 'Workyy',
      brandDescription: 'Смешанные SQL и Python узлы, DAG и совместная аналитика на одной канве.',
      product: {
        title: 'PRODUCT',
        canvas: 'The Canvas',
        collaboration: 'Collaboration',
        performance: 'Performance',
        pricing: 'Pricing',
        changelog: 'Changelog',
        roadmap: 'Roadmap',
      },
      useCases: {
        title: 'USE CASES',
        dataAnalysis: 'Data analysis',
        selfServe: 'Self-serve analytics',
        reporting: 'Reporting',
        dataModeling: 'Data modeling',
        productAnalytics: 'Product analytics',
        financeOps: 'Finance & Ops',
      },
      compare: {
        title: 'COMPARE',
        classicBi: 'Workyy vs классические BI',
        notebooks: 'Workyy vs ноутбуки',
        smallTeams: 'Workyy для маленьких команд',
        startups: 'Workyy для стартапов',
      },
      integrations: {
        title: 'INTEGRATIONS',
        postgres: 'Postgres',
        snowflake: 'Snowflake',
        bigquery: 'BigQuery',
        mysql: 'MySQL',
        csvFiles: 'CSV / файлы',
      },
      resources: {
        title: 'RESOURCES',
        security: 'Security',
        privacy: 'Privacy Policy',
        terms: 'Terms of Use',
      },
    },
  },
};

export const getContent = (lang: Language): Content => {
  return content[lang];
};
