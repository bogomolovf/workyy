export type Locale = 'ru' | 'en';

export type TranslationMessages = {
  // page.tsx
  backToWebsite: string;
  workyyMvp: string;
  tagline: string;
  yourBoards: string;
  participants: string;
  manageMembers: string;
  boardsDescription: string;
  newBoardPlaceholder: string;
  create: string;
  creating: string;
  loadingBoards: string;
  loadBoardsError: string;
  noBoards: string;
  updated: string;
  deleteBoard: string;
  deleteBoardConfirm: (title: string) => string;
  logOut: string;
  logOutTitle: string;
  workspace: string;
  workspaces: string;
  workspaceNotFound: string;
  enterBoardTitle: string;
  createBoardError: string;
  demoDataNote: string;
  gridView: string;
  listView: string;

  // CursorColorPicker
  cursorColor: string;
  defaultCursor: string;
  selectColor: (color: string) => string;

  // Team
  team: string;
  teams: string;
  currentTeam: string;
  selectTeam: string;
  switchTeam: string;
  teamMembers: string;
  noTeamsAvailable: string;
  teamNotFound: string;
  createTeam: string;
  createTeamPlaceholder: string;
  searchTeams: string;
  allTeams: string;

  // Sidebar
  sidebarHome: string;
  sidebarRecent: string;
  sidebarStarred: string;
  spaces: string;
  boardsInThisTeam: string;
  searchByTitle: string;
  inviteMembers: string;
  createNew: string;
  filterBy: string;
  allBoards: string;
  ownedByMe: string;
  sortBy: string;
  lastOpened: string;
  owner: string;
  onlineUsers: string;

  // WorkspaceMembers
  workspaceMembersTitle: string;
  addMember: string;
  addMemberPending: string;
  enterEmail: string;
  roleOwner: string;
  roleEditor: string;
  roleViewer: string;
  addMemberError: string;
  removeMemberError: string;
  updateRoleError: string;
  removeMemberConfirm: string;
  loadingMembers: string;
  loadMembersError: string;
  noMembers: string;
  removeMemberTitle: string;
  membersFooter: string;

  // Board page and canvas
  invalidBoardIdPrefix: string;
  invalidBoardIdLink: string;
  invalidBoardIdSuffix: string;
  backToHome: string;
  loadingBoard: string;
  failedToLoadBoard: string;
  checkRealtimeServer: (url: string) => string;
  board: string;
  uploadFileSuccess: (fileName: string, tableName: string, rows: number) => string;
  tableDeleted: (tableName: string) => string;
  deleteTableConfirm: (tableName: string) => string;
  uploadFileError: string;
  deleteTableError: string;
  saveBoardError: string;

  // BoardCommandBar
  toolSelect: string;
  toolSticky: string;
  toolPen: string;
  toolText: string;
  toolShape: string;
  toolVoice: string;
  toolEraser: string;
  addSqlNode: string;
  addPythonNode: string;
  addDatabaseNode: string;
  addPlotNode: string;
  uploadCsvExcel: string;
  uploadNotebook: string;
  deleteSelection: string;
  sqlCell: string;
  pythonCell: string;
  runCell: string;
  runDownstream: string;
  statusIdle: string;
  statusRunning: string;
  statusSuccess: string;
  statusError: string;
  undoTitle: string;
  redoTitle: string;
  undoLabel: string;
  redoLabel: string;
  boardMenuTitle: string;
  deleteCurrentBoardConfirm: string;

  // BoardMenu (keyed by menu item id)
  boardMenu: Record<string, string>;

  // Shape labels (keyed by shape type)
  shapeLabels: Record<string, string>;

  // Task Tracker
  tracker: Record<string, string>;

  // Settings
  settingsTitle: string;
  settingsButton: string;
  settingsProfile: string;
  settingsNickname: string;
  settingsName: string;
  nicknameHint: string;
  settingsSystem: string;
  settingsTheme: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  settingsCursorColor: string;
  settingsOther: string;
  reduceMotion: string;
  reduceMotionHint: string;
  resetSettings: string;
  resetSettingsConfirm: string;
  saved: string;
  save: string;
  cancel: string;

  // User Profile page
  profileSettings: string;
  goToBoards: string;
  name: string;
  organization: string;
  industry: string;
  role: string;
  profilePicture: string;
  defaultAvatar: string;
  upload: string;
  language: string;
  email: string;
  changeEmail: string;
  password: string;
  changePassword: string;
  privacy: string;
  privacyHint: string;
  signOutEverywhere: string;
  signOutEverywhereHint: string;
  deleteProfile: string;
  deleteProfileHint: string;
  notifications: string;
  communicationPreferences: string;
  boardActivityConversation: string;
  whenBoardSharedWithMe: string;
  whenBoardSharedWithTeam: string;
  whenSomeoneRequestsAccessToMyBoard: string;
  whenSomeoneCommentsInThreadsFollowing: string;
  whenSomeoneMentionsMe: string;
  talktrackUpdates: string;
  summaryOfChangesOnBoards: string;
  startingAt: string;
  onceEvery: string;
  timeZone: string;
  tables: string;
  whenRecordAssignedToMe: string;
  spaceActivity: string;
  whenSomeoneAddsMeToSpace: string;
  teamActivity: string;
  whenInviteesSignUp: string;
  whenSomeoneRequestsAccessToTeam: string;
  whenSomeoneInvitesMeToTeam: string;
  otherEmailUpdates: string;
  tipsHowTos: string;
  tipsHowTosDesc: string;
  productFeatureUpdates: string;
  productFeatureUpdatesDesc: string;
  eventsPromotions: string;
  eventsPromotionsDesc: string;
  surveysProductTesting: string;
  surveysProductTestingDesc: string;
  unsubscribeFromAll: string;
  unsubscribeNote: string;
  hours: string;
  detectedTimezone: string;
  deleteAccountConfirm: string;
  changeEmailSoon: string;
  changePasswordSoon: string;
};

const messages: Record<Locale, TranslationMessages> = {
  ru: {
    backToWebsite: '← На главную',
    workyyMvp: 'Workyy MVP',
    tagline:
      'Смешанные SQL и Python узлы, DAG и совместная работа в реальном времени в одном браузере.',
    yourBoards: 'Ваши доски',
    participants: 'Участники',
    manageMembers: 'Управление участниками команды',
    boardsDescription: 'Открывайте существующие или создайте новую доску прямо отсюда.',
    newBoardPlaceholder: 'Название новой доски',
    create: 'Создать',
    creating: 'Создаём…',
    loadingBoards: 'Загружаем список досок…',
    loadBoardsError: 'Не удалось загрузить список досок. Проверьте соединение с realtime-сервером.',
    noBoards: 'Досок пока нет — создайте первую и начните собирать пайплайны.',
    updated: 'Обновлено',
    deleteBoard: 'Удалить доску',
    deleteBoardConfirm: (title) => `Удалить доску "${title}"? Это действие нельзя отменить.`,
    logOut: 'Выйти',
    logOutTitle: 'Выйти и войти с другого аккаунта',
    workspace: 'workspace',
    workspaces: 'workspaces',
    workspaceNotFound: 'Не найдена команда для создания доски. Выберите команду в меню.',
    enterBoardTitle: 'Введите название доски.',
    createBoardError: 'Не удалось создать доску',
    demoDataNote:
      'Готовые демо-данные остаются доступны: открывайте любую доску, ссылка ведёт на canvas-представление.',
    gridView: 'Сетка',
    listView: 'Список',

    team: 'Команда',
    teams: 'Команды',
    currentTeam: 'Текущая команда',
    selectTeam: 'Выбрать команду',
    switchTeam: 'Переключить команду',
    teamMembers: 'Участники команды',
    noTeamsAvailable: 'Нет доступных команд',
    teamNotFound: 'Не найдена команда для создания доски.',
    createTeam: 'Создать команду',
    createTeamPlaceholder: 'Название команды',
    searchTeams: 'Поиск команд',
    allTeams: 'Все команды',

    sidebarHome: 'Главная',
    sidebarRecent: 'Недавние',
    sidebarStarred: 'Избранное',
    spaces: 'Пространства',
    boardsInThisTeam: 'Доски в этой команде',
    searchByTitle: 'Поиск по названию…',
    inviteMembers: 'Пригласить участников',
    createNew: '+ Создать доску',
    filterBy: 'Фильтр',
    allBoards: 'Все доски',
    ownedByMe: 'Мои',
    sortBy: 'Сортировка',
    lastOpened: 'Последние открытые',
    owner: 'Владелец',
    onlineUsers: 'Онлайн',

    cursorColor: 'Цвет курсора:',
    defaultCursor: 'Стандартный курсор (системный)',
    selectColor: (color) => `Выбрать цвет ${color}`,

    workspaceMembersTitle: 'Участники команды',
    addMember: 'Добавить участника',
    addMemberPending: 'Добавляем…',
    enterEmail: 'Введите email',
    roleOwner: 'Владелец',
    roleEditor: 'Редактор',
    roleViewer: 'Наблюдатель',
    addMemberError: 'Не удалось добавить участника',
    removeMemberError: 'Не удалось удалить участника',
    updateRoleError: 'Не удалось обновить роль',
    removeMemberConfirm: 'Вы уверены, что хотите удалить этого участника из команды?',
    loadingMembers: 'Загрузка участников…',
    loadMembersError: 'Не удалось загрузить список участников',
    noMembers: 'В команде пока нет участников',
    removeMemberTitle: 'Удалить участника',
    membersFooter:
      'Участники команды могут видеть и работать с досками в этой команде. Для тестирования коллаборации добавьте другого пользователя и откройте одну и ту же доску в разных браузерах.',

    invalidBoardIdPrefix: 'Некорректный идентификатор борда. Вернитесь на ',
    invalidBoardIdLink: 'главную',
    invalidBoardIdSuffix: ' и выберите борд из списка.',
    backToHome: '← На главную',
    loadingBoard: 'Загрузка доски…',
    failedToLoadBoard: 'Не удалось загрузить доску',
    checkRealtimeServer: (url) => `Проверьте, что realtime-сервер доступен по ${url}`,
    board: 'Доска',
    uploadFileSuccess: (fileName, tableName, rows) =>
      `Загружено ${fileName} → таблица ${tableName} (${rows} строк).`,
    tableDeleted: (tableName) => `Таблица "${tableName}" удалена.`,
    deleteTableConfirm: (tableName) =>
      `Удалить таблицу "${tableName}"? Это действие нельзя отменить.`,
    uploadFileError: 'Не удалось загрузить файл',
    deleteTableError: 'Не удалось удалить таблицу',
    saveBoardError: 'Не удалось сохранить доску',

    toolSelect: 'Выбор',
    toolSticky: 'Стикер',
    toolPen: 'Ручка',
    toolText: 'Текст',
    toolShape: 'Фигура',
    toolVoice: 'Голос',
    toolEraser: 'Ластик',
    addSqlNode: 'Добавить SQL узел',
    addPythonNode: 'Добавить Python узел',
    addDatabaseNode: 'Добавить узел Database (D)',
    addPlotNode: 'Добавить узел Plot (P)',
    uploadCsvExcel: 'Загрузить CSV/Excel',
    uploadNotebook: 'Загрузить Jupyter Notebook (.ipynb)',
    deleteSelection: 'Удалить выбранное (Delete)',
    sqlCell: 'SQL ячейка',
    pythonCell: 'Python ячейка',
    runCell: 'Запустить (Shift+Enter)',
    runDownstream: 'Запустить downstream (Ctrl+Shift+Enter)',
    statusIdle: 'Ожидание',
    statusRunning: 'Выполняется',
    statusSuccess: 'Успешно',
    statusError: 'Ошибка',
    undoTitle: 'Отменить последнее изменение (Ctrl+Z)',
    redoTitle: 'Повторить последнее отменённое изменение (Ctrl+Shift+Z)',
    undoLabel: 'Отменить',
    redoLabel: 'Повторить',
    boardMenuTitle: 'Меню доски',
    deleteCurrentBoardConfirm: 'Удалить эту доску? Это действие нельзя отменить.',

    boardMenu: {
      board: 'Доска',
      edit: 'Правка',
      view: 'Вид',
      preferences: 'Настройки',
      catchUp: 'Наверстать',
      newBoard: '+ Новая доска',
      duplicate: 'Дублировать',
      export: 'Экспорт',
      exportPdf: 'Сохранить в PDF',
      exportImage: 'Экспорт в изображение',
      saveAsTemplate: 'Сохранить доску как шаблон',
      exportSpreadsheet: 'Экспорт в таблицу (CSV)',
      downloadBackup: 'Скачать резервную копию',
      embed: 'Встроить',
      saveToGoogleDrive: 'Сохранить в Google Drive',
      moveTo: 'Переместить в',
      starBoard: 'Добавить в избранное',
      unstarBoard: 'Убрать из избранного',
      delete: 'Удалить',
      backgroundColor: 'Цвет фона',
      startView: 'Начать просмотр',
      lockDefaultView: 'Закрепить вид по умолчанию',
      history: 'История',
      details: 'Подробности',
      undo: 'Отменить',
      redo: 'Повторить',
      commands: 'Команды',
      find: 'Найти',
      grid: 'Сетка',
      showCollaboratorCursors: 'Курсоры участников',
      showComments: 'Комментарии на доске',
      showScrollbars: 'Полосы прокрутки',
      showObjectDimensions: 'Размеры объектов',
      showUndoRedoControls: 'Элементы Отменить/Повторить',
      fullscreen: 'Полноэкранный режим',
      mouseOrTrackpad: 'Мышь или трекпад',
      invertScroll: 'Инвертировать прокрутку',
      scrollAndZoom: 'Прокрутка и масштаб',
      scrollToPan: 'Прокрутка для перемещения',
      alignObjects: 'Выровнять объекты',
      followAllThreads: 'Отслеживать все обсуждения',
      profileSettings: 'Настройки профиля',
      gridVisible: 'Показать сетку',
      snapToGrid: 'Привязка к сетке',
      gridSizeSmall: 'Маленькая',
      gridSizeMedium: 'Средняя',
      gridSizeLarge: 'Большая',
      notSupportedYet: 'Пока не поддерживается',
      actionFailed: 'Действие не выполнено',
      share: 'Поделиться',
      copyBoardLink: 'Копировать ссылку',
      openInNewTab: 'Открыть в новой вкладке',
      rename: 'Переименовать',
      changeThumbnail: 'Изменить превью',
      makeBoardPrivate: 'Сделать доску приватной',
      leave: 'Покинуть доску',
      moveToTeam: 'Переместить в Team',
      duplicateBoardNamePrompt: 'Название дубликата доски:',
      catchUpGoTo: 'Перейти',
      catchUpAllCaughtUp: 'Вы в курсе всех изменений!',
      catchUpFitView: 'Показать всё',
      historyClear: 'Очистить',
      historyEmpty: 'Пока нет истории',
      historyChange: 'Изменение',
      historyUndone: 'Отменено',
      historyUndoTo: 'Отменить до этого шага',
      detailsTitle: 'Название',
      detailsBoardId: 'ID доски',
      detailsWorkspace: 'Рабочее пространство',
      detailsNodes: 'Узлы',
      detailsEdges: 'Связи',
      detailsCollaborators: 'Онлайн',
      detailsCreatedAt: 'Создана',
      commandsPlaceholder: 'Введите команду…',
      commandsEmpty: 'Ничего не найдено',
      findPlaceholder: 'Поиск по узлам…',
    },

    home: 'Главная',
    navigate: 'Навигация',
    addTextNode: 'Добавить текстовый узел',
    addStickyNode: 'Добавить стикер',
    addShapeNode: 'Добавить фигуру',

    shapeLabels: {
      _categoryBasic: 'Фигуры',
      _categoryFlowchart: 'Блок-схемы',
      _categoryLines: 'Линии',
      rectangle: 'Прямоугольник',
      'round-rectangle': 'Скруглённый прямоугольник',
      circle: 'Круг',
      diamond: 'Ромб',
      triangle: 'Треугольник',
      ellipse: 'Эллипс',
      hexagon: 'Шестиугольник',
      pentagon: 'Пятиугольник',
      octagon: 'Восьмиугольник',
      parallelogram: 'Параллелограмм',
      cylinder: 'Цилиндр',
      'arrow-rectangle': 'Прямоугольник со стрелкой',
      plus: 'Плюс',
      star: 'Звезда',
      heart: 'Сердце',
      cloud: 'Облако',
      'speech-bubble': 'Выноска',
      'document-shape': 'Документ',
      banner: 'Баннер',
      line: 'Линия',
      arrow: 'Стрелка',
    },

    tracker: {
      trackers: 'Трекеры',
      boards: 'Доски',
      createTracker: '+ Создать трекер',
      newTrackerPlaceholder: 'Название нового трекера',
      noTrackers: 'Трекеров пока нет — создайте первый для управления задачами.',
      loadingTrackers: 'Загрузка трекеров…',
      deleteTracker: 'Удалить трекер',
      deleteTrackerConfirm: 'Удалить этот трекер? Это действие нельзя отменить.',
      addTask: '+ Задача',
      addColumn: '+ Колонка',
      newColumnPlaceholder: 'Название колонки',
      deleteColumn: 'Удалить колонку',
      renameColumn: 'Переименовать',
      markAsFinal: 'Финальный статус',
      taskTitle: 'Название задачи',
      description: 'Описание',
      status: 'Статус',
      assignee: 'Исполнитель',
      unassigned: 'Не назначен',
      priority: 'Приоритет',
      priorityLow: 'Низкий',
      priorityMedium: 'Средний',
      priorityHigh: 'Высокий',
      priorityUrgent: 'Срочный',
      noPriority: 'Без приоритета',
      dueDate: 'Срок',
      noDueDate: 'Не задан',
      labels: 'Метки',
      noLabels: 'Нет меток',
      createLabel: 'Создать метку',
      labelName: 'Название метки',
      subtasks: 'Подзадачи',
      noSubtasks: 'Нет подзадач',
      addSubtask: '+ Подзадача',
      comments: 'Комментарии',
      noComments: 'Нет комментариев',
      addComment: 'Написать комментарий…',
      send: 'Отправить',
      completed: 'Завершено',
      backToHome: '← На главную',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      deleteTaskConfirm: 'Удалить эту задачу?',
      close: 'Закрыть',
      tasks: 'задач',
      tabChat: 'Чат',
      tabInfoLog: 'Инфо / Лог',
      tabDescription: 'Описание',
      tabSubtasks: 'Подзадачи*',
      activityTaskCreated: 'Задача создана',
      activityTaskMoved: 'Перемещена',
      activityStatusChanged: 'Статус изменён',
      activityAssigneeChanged: 'Исполнитель изменён',
      activityPriorityChanged: 'Приоритет изменён',
      activityCommentAdded: 'Комментарий добавлен',
      activityLabelAdded: 'Метка добавлена',
      activityLabelRemoved: 'Метка удалена',
      activitySubtaskCreated: 'Подзадача создана',
      activityTaskDeleted: 'Задача удалена',
      noActivity: 'Нет активности',
      emptyColumn: 'Задач пока нет',
      confirmDeleteColumn: 'Удалить эту колонку?',
      confirmDeleteColumnWithTasks: 'задач будут перемещены в другую колонку.',
      filterAssignee: 'Исполнитель',
      filterPriority: 'Приоритет',
      filterDueDate: 'Срок',
      allFilters: 'Все',
      openTracker: 'Открыть трекер',
      createTrackerCmd: 'Создать трекер',
      from: 'из',
      to: 'в',
    },

    settingsTitle: 'Настройки',
    settingsButton: 'Настройки',
    settingsProfile: 'Профиль',
    settingsNickname: 'Никнейм',
    settingsName: 'Имя',
    nicknameHint: 'Другие участники видят этот никнейм рядом с вашим курсором.',
    settingsSystem: 'Система',
    settingsTheme: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    themeSystem: 'Системная',
    settingsCursorColor: 'Цвет курсора',
    settingsOther: 'Прочее',
    reduceMotion: 'Уменьшить анимации',
    reduceMotionHint: 'Учитывает системную настройку и позволяет переопределить.',
    resetSettings: 'Сбросить настройки',
    resetSettingsConfirm: 'Сбросить профиль, тему и цвет курсора в значения по умолчанию?',
    saved: 'Сохранено',
    save: 'Сохранить',
    cancel: 'Отмена',

    profileSettings: 'Настройки профиля',
    goToBoards: 'К доскам',
    name: 'Имя',
    organization: 'Организация',
    industry: 'Отрасль',
    role: 'Роль',
    profilePicture: 'Фото профиля',
    defaultAvatar: 'Аватар по умолчанию',
    upload: 'Загрузить',
    language: 'Язык',
    email: 'Email',
    changeEmail: 'Изменить email',
    password: 'Пароль',
    changePassword: 'Изменить пароль',
    privacy: 'Конфиденциальность',
    privacyHint: 'Управление cookies. Настройки привязаны к браузеру.',
    signOutEverywhere: 'Выйти везде',
    signOutEverywhereHint: 'Вы выйдете из всех сессий на всех устройствах.',
    deleteProfile: 'Удалить аккаунт',
    deleteProfileHint: 'Вам придёт письмо для подтверждения удаления.',
    notifications: 'Уведомления',
    communicationPreferences: 'Предпочтения коммуникации',
    boardActivityConversation: 'Активность на досках и комментарии',
    whenBoardSharedWithMe: 'Когда доска расшарена со мной',
    whenBoardSharedWithTeam: 'Когда доска расшарена с командой',
    whenSomeoneRequestsAccessToMyBoard: 'Когда запрашивают доступ к моей доске',
    whenSomeoneCommentsInThreadsFollowing: 'Когда комментируют в обсуждениях, которые я отслеживаю',
    whenSomeoneMentionsMe: 'Когда меня @упоминают',
    talktrackUpdates: 'Обновления Talktrack',
    summaryOfChangesOnBoards: 'Сводка изменений на моих досках',
    startingAt: 'Начиная с',
    onceEvery: 'Раз в',
    timeZone: 'Часовой пояс',
    tables: 'Таблицы',
    whenRecordAssignedToMe: 'Когда запись назначена мне',
    spaceActivity: 'Активность в Space',
    whenSomeoneAddsMeToSpace: 'Когда меня добавляют в Space',
    teamActivity: 'Активность команды',
    whenInviteesSignUp: 'Когда приглашённые регистрируются',
    whenSomeoneRequestsAccessToTeam: 'Когда запрашивают доступ в команду',
    whenSomeoneInvitesMeToTeam: 'Когда меня приглашают в команду',
    otherEmailUpdates: 'Прочие email-рассылки',
    tipsHowTos: 'Советы и инструкции',
    tipsHowTosDesc: 'Обучающие материалы, статьи, видео и best practices.',
    productFeatureUpdates: 'Обновления продукта и функций',
    productFeatureUpdatesDesc: 'Ранние бета-версии, релизы и улучшения.',
    eventsPromotions: 'События и акции',
    eventsPromotionsDesc: 'Специальные предложения и мероприятия.',
    surveysProductTesting: 'Опросы и тестирование',
    surveysProductTestingDesc: 'Приглашения к опросам и бета-тестированию.',
    unsubscribeFromAll: 'Отписаться от всего',
    unsubscribeNote: 'Вы по-прежнему будете получать важные административные письма.',
    hours: 'ч',
    detectedTimezone: 'Определено по вашему местоположению',
    deleteAccountConfirm: 'Удалить аккаунт? Вам придёт письмо для подтверждения.',
    changeEmailSoon: 'Скоро будет доступно',
    changePasswordSoon: 'Скоро будет доступно',
  },
  en: {
    backToWebsite: '← Back to website',
    workyyMvp: 'Workyy MVP',
    tagline: 'Mixed SQL and Python nodes, DAG and real-time collaboration in one browser.',
    yourBoards: 'Your boards',
    participants: 'Participants',
    manageMembers: 'Manage team members',
    boardsDescription: 'Open existing boards or create a new one right here.',
    newBoardPlaceholder: 'New board name',
    create: 'Create',
    creating: 'Creating…',
    loadingBoards: 'Loading boards…',
    loadBoardsError: 'Failed to load boards. Check connection to the realtime server.',
    noBoards: 'No boards yet — create one and start building pipelines.',
    updated: 'Updated',
    deleteBoard: 'Delete board',
    deleteBoardConfirm: (title) => `Delete board "${title}"? This action cannot be undone.`,
    logOut: 'Log out',
    logOutTitle: 'Log out and sign in with another account',
    workspace: 'workspace',
    workspaces: 'workspaces',
    workspaceNotFound: 'No team found for creating a board. Select a team from the menu.',
    enterBoardTitle: 'Enter board name.',
    createBoardError: 'Failed to create board',
    demoDataNote: 'Demo data remains available: open any board; the link leads to the canvas view.',
    gridView: 'Grid',
    listView: 'List',

    team: 'Team',
    teams: 'Teams',
    currentTeam: 'Current team',
    selectTeam: 'Select team',
    switchTeam: 'Switch team',
    teamMembers: 'Team members',
    noTeamsAvailable: 'No teams available',
    teamNotFound: 'No team found for creating a board.',
    createTeam: 'Create team',
    createTeamPlaceholder: 'Team name',
    searchTeams: 'Search teams',
    allTeams: 'All teams',

    sidebarHome: 'Home',
    sidebarRecent: 'Recent',
    sidebarStarred: 'Starred',
    spaces: 'Spaces',
    boardsInThisTeam: 'Boards in this team',
    searchByTitle: 'Search by title or topic',
    inviteMembers: 'Invite members',
    createNew: '+ Create new',
    filterBy: 'Filter by',
    allBoards: 'All boards',
    ownedByMe: 'Owned by me',
    sortBy: 'Sort by',
    lastOpened: 'Last opened',
    owner: 'Owner',
    onlineUsers: 'Online users',

    cursorColor: 'Cursor color:',
    defaultCursor: 'Default cursor (system)',
    selectColor: (color) => `Select color ${color}`,

    workspaceMembersTitle: 'Team members',
    addMember: 'Add member',
    addMemberPending: 'Adding…',
    enterEmail: 'Enter email',
    roleOwner: 'Owner',
    roleEditor: 'Editor',
    roleViewer: 'Viewer',
    addMemberError: 'Failed to add member',
    removeMemberError: 'Failed to remove member',
    updateRoleError: 'Failed to update role',
    removeMemberConfirm: 'Are you sure you want to remove this member from the team?',
    loadingMembers: 'Loading members…',
    loadMembersError: 'Failed to load members list',
    noMembers: 'No members in this team yet',
    removeMemberTitle: 'Remove member',
    membersFooter:
      'Team members can view and work with boards in this team. To test collaboration, add another user and open the same board in different browsers.',

    invalidBoardIdPrefix: 'Invalid board ID. Return to ',
    invalidBoardIdLink: 'home',
    invalidBoardIdSuffix: ' and select a board from the list.',
    backToHome: '← Back to home',
    loadingBoard: 'Loading board…',
    failedToLoadBoard: 'Failed to load board',
    checkRealtimeServer: (url) => `Check that the realtime server is available at ${url}`,
    board: 'Board',
    uploadFileSuccess: (fileName, tableName, rows) =>
      `Uploaded ${fileName} → table ${tableName} (${rows} rows).`,
    tableDeleted: (tableName) => `Table "${tableName}" deleted.`,
    deleteTableConfirm: (tableName) => `Delete table "${tableName}"? This action cannot be undone.`,
    uploadFileError: 'Failed to upload file',
    deleteTableError: 'Failed to delete table',
    saveBoardError: 'Failed to save board',

    toolSelect: 'Select',
    toolSticky: 'Sticky',
    toolPen: 'Pen',
    toolText: 'Text',
    toolShape: 'Shape',
    toolVoice: 'Voice',
    toolEraser: 'Eraser',
    addSqlNode: 'Add SQL node',
    addPythonNode: 'Add Python node',
    addDatabaseNode: 'Add Database node (D)',
    addPlotNode: 'Add Plot node (P)',
    uploadCsvExcel: 'Upload CSV/Excel',
    uploadNotebook: 'Upload Jupyter Notebook (.ipynb)',
    deleteSelection: 'Delete selection (Delete)',
    sqlCell: 'SQL cell',
    pythonCell: 'Python cell',
    runCell: 'Run cell (Shift+Enter)',
    runDownstream: 'Run downstream (Ctrl+Shift+Enter)',
    statusIdle: 'Idle',
    statusRunning: 'Running',
    statusSuccess: 'Success',
    statusError: 'Error',
    undoTitle: 'Undo your last change (Ctrl+Z)',
    redoTitle: 'Redo your last undone change (Ctrl+Shift+Z)',
    undoLabel: 'Undo',
    redoLabel: 'Redo',
    boardMenuTitle: 'Board menu',
    deleteCurrentBoardConfirm: 'Delete this board? This action cannot be undone.',

    boardMenu: {
      board: 'Board',
      edit: 'Edit',
      view: 'View',
      preferences: 'Preferences',
      catchUp: 'Catch up',
      newBoard: '+ New board',
      duplicate: 'Duplicate',
      export: 'Export',
      exportPdf: 'Save as PDF',
      exportImage: 'Export as image',
      saveAsTemplate: 'Save board as template',
      exportSpreadsheet: 'Export to spreadsheet (CSV)',
      downloadBackup: 'Download board backup',
      embed: 'Embed',
      saveToGoogleDrive: 'Save to Google Drive',
      moveTo: 'Move to',
      starBoard: 'Star this board',
      unstarBoard: 'Unstar this board',
      delete: 'Delete',
      backgroundColor: 'Background color',
      startView: 'Start view',
      lockDefaultView: 'Lock default view',
      history: 'History',
      details: 'Details',
      undo: 'Undo',
      redo: 'Redo',
      commands: 'Commands',
      find: 'Find',
      grid: 'Grid',
      showCollaboratorCursors: "Show collaborators' cursors",
      showComments: 'Comments on board',
      showScrollbars: 'Scroll bars',
      showObjectDimensions: 'Object dimensions',
      showUndoRedoControls: 'Undo/Redo controls',
      fullscreen: 'Enter full screen',
      mouseOrTrackpad: 'Mouse or trackpad',
      invertScroll: 'Invert scroll direction',
      scrollAndZoom: 'Scroll and zoom',
      scrollToPan: 'Scroll to pan',
      alignObjects: 'Align objects',
      followAllThreads: 'Follow all threads',
      profileSettings: 'Profile settings',
      gridVisible: 'Show grid',
      snapToGrid: 'Snap to grid',
      gridSizeSmall: 'Small',
      gridSizeMedium: 'Medium',
      gridSizeLarge: 'Large',
      notSupportedYet: 'Not supported yet',
      actionFailed: 'Action failed',
      share: 'Share',
      copyBoardLink: 'Copy board link',
      openInNewTab: 'Open in new tab',
      rename: 'Rename',
      changeThumbnail: 'Change thumbnail',
      makeBoardPrivate: 'Make board private',
      leave: 'Leave board',
      moveToTeam: 'Move to Team',
      duplicateBoardNamePrompt: 'Name for duplicated board:',
      catchUpGoTo: 'Go to',
      catchUpAllCaughtUp: 'All caught up!',
      catchUpFitView: 'Fit all to view',
      historyClear: 'Clear',
      historyEmpty: 'No history yet',
      historyChange: 'Change',
      historyUndone: 'Undone',
      historyUndoTo: 'Undo to here',
      detailsTitle: 'Title',
      detailsBoardId: 'Board ID',
      detailsWorkspace: 'Workspace',
      detailsNodes: 'Nodes',
      detailsEdges: 'Edges',
      detailsCollaborators: 'Online',
      detailsCreatedAt: 'Created',
      commandsPlaceholder: 'Type a command…',
      commandsEmpty: 'No results',
      findPlaceholder: 'Search nodes…',
    },

    home: 'Home',
    navigate: 'Navigate',
    addTextNode: 'Add Text node',
    addStickyNode: 'Add Sticky note',
    addShapeNode: 'Add Shape',

    shapeLabels: {
      _categoryBasic: 'Shapes',
      _categoryFlowchart: 'Flowchart',
      _categoryLines: 'Lines',
      rectangle: 'Rectangle',
      'round-rectangle': 'Round Rectangle',
      circle: 'Circle',
      diamond: 'Diamond',
      triangle: 'Triangle',
      ellipse: 'Ellipse',
      hexagon: 'Hexagon',
      pentagon: 'Pentagon',
      octagon: 'Octagon',
      parallelogram: 'Parallelogram',
      cylinder: 'Cylinder',
      'arrow-rectangle': 'Arrow Rectangle',
      plus: 'Plus',
      star: 'Star',
      heart: 'Heart',
      cloud: 'Cloud',
      'speech-bubble': 'Speech Bubble',
      'document-shape': 'Document',
      banner: 'Banner',
      line: 'Line',
      arrow: 'Arrow',
    },

    tracker: {
      trackers: 'Trackers',
      boards: 'Boards',
      createTracker: '+ Create tracker',
      newTrackerPlaceholder: 'New tracker name',
      noTrackers: 'No trackers yet — create one to manage tasks.',
      loadingTrackers: 'Loading trackers…',
      deleteTracker: 'Delete tracker',
      deleteTrackerConfirm: 'Delete this tracker? This action cannot be undone.',
      addTask: '+ Task',
      addColumn: '+ Column',
      newColumnPlaceholder: 'Column name',
      deleteColumn: 'Delete column',
      renameColumn: 'Rename',
      markAsFinal: 'Final status',
      taskTitle: 'Task title',
      description: 'Description',
      status: 'Status',
      assignee: 'Assignee',
      unassigned: 'Unassigned',
      priority: 'Priority',
      priorityLow: 'Low',
      priorityMedium: 'Medium',
      priorityHigh: 'High',
      priorityUrgent: 'Urgent',
      noPriority: 'No priority',
      dueDate: 'Due date',
      noDueDate: 'No due date',
      labels: 'Labels',
      noLabels: 'No labels',
      createLabel: 'Create label',
      labelName: 'Label name',
      subtasks: 'Subtasks',
      noSubtasks: 'No subtasks',
      addSubtask: '+ Subtask',
      comments: 'Comments',
      noComments: 'No comments yet',
      addComment: 'Write a comment…',
      send: 'Send',
      completed: 'Completed',
      backToHome: '← Back to home',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      deleteTaskConfirm: 'Delete this task?',
      close: 'Close',
      tasks: 'tasks',
      tabChat: 'Chat',
      tabInfoLog: 'Info / Log',
      tabDescription: 'Description',
      tabSubtasks: 'Subtasks',
      activityTaskCreated: 'Task created',
      activityTaskMoved: 'Moved',
      activityStatusChanged: 'Status changed',
      activityAssigneeChanged: 'Assignee changed',
      activityPriorityChanged: 'Priority changed',
      activityCommentAdded: 'Comment added',
      activityLabelAdded: 'Label added',
      activityLabelRemoved: 'Label removed',
      activitySubtaskCreated: 'Subtask created',
      activityTaskDeleted: 'Task deleted',
      noActivity: 'No activity yet',
      emptyColumn: 'No tasks yet',
      confirmDeleteColumn: 'Delete this column?',
      confirmDeleteColumnWithTasks: 'tasks will be moved to another column.',
      filterAssignee: 'Assignee',
      filterPriority: 'Priority',
      filterDueDate: 'Due date',
      allFilters: 'All',
      openTracker: 'Open tracker',
      createTrackerCmd: 'Create tracker',
      from: 'from',
      to: 'to',
    },

    settingsTitle: 'Settings',
    settingsButton: 'Settings',
    settingsProfile: 'Profile',
    settingsNickname: 'Nickname',
    settingsName: 'Name',
    nicknameHint: 'Collaborators see this nickname next to your cursor.',
    settingsSystem: 'System',
    settingsTheme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    settingsCursorColor: 'Cursor color',
    settingsOther: 'Other',
    reduceMotion: 'Reduce motion',
    reduceMotionHint: 'Honors system preference and allows override.',
    resetSettings: 'Reset settings',
    resetSettingsConfirm: 'Reset profile, theme, and cursor color to defaults?',
    saved: 'Saved',
    save: 'Save',
    cancel: 'Cancel',

    profileSettings: 'Profile settings',
    goToBoards: 'Go to boards',
    name: 'Name',
    organization: 'Organization',
    industry: 'Industry',
    role: 'Role',
    profilePicture: 'Profile picture',
    defaultAvatar: 'Default profile avatar',
    upload: 'Upload',
    language: 'Language',
    email: 'Email',
    changeEmail: 'Change Email',
    password: 'Password',
    changePassword: 'Change Password',
    privacy: 'Privacy',
    privacyHint: 'Manage how Workyy uses cookies. Settings are tied to your browser.',
    signOutEverywhere: 'Sign out everywhere',
    signOutEverywhereHint: 'This will sign you out of all sessions on all devices.',
    deleteProfile: 'Delete account',
    deleteProfileHint: "You'll receive an email asking you to confirm the deletion.",
    notifications: 'Notifications',
    communicationPreferences: 'Communication Preferences',
    boardActivityConversation: 'Board activity & conversation',
    whenBoardSharedWithMe: 'When a board is shared with me',
    whenBoardSharedWithTeam: 'When a board is shared with a team',
    whenSomeoneRequestsAccessToMyBoard: 'When someone requests access to my board',
    whenSomeoneCommentsInThreadsFollowing: "When someone comments in threads I'm following",
    whenSomeoneMentionsMe: 'When someone @mentions me in any comments',
    talktrackUpdates: 'Talktrack updates',
    summaryOfChangesOnBoards: 'Summary of changes on my boards',
    startingAt: 'Starting at',
    onceEvery: 'Once every',
    timeZone: 'Time Zone',
    tables: 'Tables',
    whenRecordAssignedToMe: 'When a record is assigned to me',
    spaceActivity: 'Space activity',
    whenSomeoneAddsMeToSpace: 'When someone adds me to a Space',
    teamActivity: 'Team activity',
    whenInviteesSignUp: 'When my invitees sign up',
    whenSomeoneRequestsAccessToTeam: 'When someone requests access to my team',
    whenSomeoneInvitesMeToTeam: 'When someone invites me to a team',
    otherEmailUpdates: 'Other email updates',
    tipsHowTos: 'Tips & how-tos on using Workyy',
    tipsHowTosDesc: 'Educational content, articles, videos, and best practices.',
    productFeatureUpdates: 'Product & feature updates',
    productFeatureUpdatesDesc: 'Early access betas, new releases, and improvements.',
    eventsPromotions: 'Events & promotions',
    eventsPromotionsDesc: 'Special promotions and upcoming events.',
    surveysProductTesting: 'Surveys & product testing',
    surveysProductTestingDesc: 'Invitations to surveys and beta testing.',
    unsubscribeFromAll: 'Unsubscribe from all of the above',
    unsubscribeNote: "Please note: you'll still receive important administrative emails.",
    hours: 'h',
    detectedTimezone: 'Detected timezone based on your location',
    deleteAccountConfirm: 'Delete account? You will receive an email to confirm.',
    changeEmailSoon: 'Coming soon',
    changePasswordSoon: 'Coming soon',
  },
};

export function getMessages(locale: Locale): TranslationMessages {
  return messages[locale];
}
