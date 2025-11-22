# 🚀 Быстрый запуск Workyy

## Проблема была в следующем:
- Backend сервер не был запущен (порт 4000)
- Отсутствовали `.env` файлы с конфигурацией
- Не был сгенерирован Prisma клиент

## ✅ Все исправлено! Теперь запуск:

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
cd ~/workyy
./start.sh
```

Этот скрипт автоматически:
- Проверит зависимости
- Сгенерирует Prisma клиент
- Проверит базу данных
- Создаст `.env` файлы при необходимости
- Запустит frontend и backend

### Вариант 2: Ручной запуск

1. Убедитесь, что PostgreSQL запущен:
```bash
# Если база не запущена:
cd ~/workyy
docker compose up -d postgres
```

2. Запустите проект:
```bash
cd ~/workyy
pnpm dev
```

### После запуска:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health check**: http://localhost:4000/health

### Проверка работы:

1. Откройте http://localhost:3000 в браузере
2. Должны загрузиться доски (если есть в базе)
3. Если видите ошибку — проверьте, что backend отвечает:
```bash
curl http://localhost:4000/health
# Должно вернуть: {"status":"ok"}
```

## 📝 Структура проекта:

```
~/workyy/
├── apps/
│   ├── web/              # Next.js frontend
│   └── realtime-server/  # Fastify backend API
├── packages/             # Внутренние пакеты
├── docker-compose.yml    # Docker конфигурация
├── start.sh              # Скрипт автоматического запуска
└── README_SETUP.md       # Детальная инструкция
```

## ⚠️ Если что-то не работает:

1. **Backend не запускается:**
   - Проверьте, что порт 4000 свободен: `netstat -tlnp | grep :4000`
   - Проверьте логи в терминале

2. **База данных не доступна:**
   - Проверьте Docker: `docker ps | grep postgres`
   - Запустите: `docker compose up -d postgres`

3. **Frontend не подключается к backend:**
   - Проверьте `apps/web/.env.local`: `NEXT_PUBLIC_WS_URL=http://localhost:4000`
   - Убедитесь, что backend запущен на порту 4000

Более детальная инструкция в `README_SETUP.md`
