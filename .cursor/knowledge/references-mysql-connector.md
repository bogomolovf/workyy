# Референсы для: MySQL Connector

## Описание фичи

Реализация MySQL коннектора по аналогии с существующим PostgreSQL коннектором. Пользователи должны иметь возможность подключаться к MySQL базам данных и выполнять SQL запросы.

## Референсы

### Библиотеки и инструменты

#### mysql2 (рекомендуемая)

- **URL**: https://www.npmjs.com/package/mysql2
- **GitHub**: https://github.com/sidorares/node-mysql2
- **Документация**: https://sidorares.github.io/node-mysql2/docs
- **Тип**: library
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Активно поддерживается (в отличие от устаревшего `mysql`)
  - Promise API из коробки (`mysql2/promise`)
  - Поддержка prepared statements
  - Connection pooling
  - SSL/TLS поддержка
  - TypeScript типы включены
  - Лучшая производительность при большом количестве rows (на 25-30% быстрее `mysql`)

### Документация и примеры

#### TypeScript Examples (mysql2)

- **URL**: https://mysql2.nodejs.cn/docs/documentation/typescript-examples
- **Тип**: documentation
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Импорт типов: `RowDataPacket`, `ResultSetHeader`
  - Использование generics для типизации результатов
  - Настройка `tsconfig.json` для работы с библиотекой

#### SSL Configuration (mysql2)

- **URL**: https://sidorares.github.io/node-mysql2/docs/documentation/ssl
- **Тип**: documentation
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `ssl: {}` для использования системных CA
  - `ssl: { rejectUnauthorized: false }` для самоподписанных сертификатов
  - Поддержка custom сертификатов (ca, cert, key)

#### Connection Pool Examples

- **URL**: https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool
- **Тип**: example
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `createPool()` для создания пула
  - `pool.promise()` для Promise API
  - Опции: `connectionLimit`, `waitForConnections`, `queueLimit`

### Сравнение драйверов

#### mysql vs mysql2 vs MariaDB

- **URL**: https://mariadb.com/resources/blog/which-node-js-connector-is-best-to-use/
- **Тип**: article
- **Релевантность**: средняя
- **Ключевые моменты**:
  - mysql2 значительно быстрее mysql для больших результатов
  - mysql2 лучше работает с concurrency
  - mysql устарел и не рекомендуется для новых проектов

## Существующая реализация PostgreSQL (референс)

### Backend файлы

1. **postgresService.ts** (`apps/realtime-server/src/services/postgresService.ts`)
   - Класс `PostgresService` с управлением пулами
   - Методы: `getPool()`, `executeQuery()`, `testConnection()`, `closePool()`
   - Использует `pg` библиотеку

2. **databaseConnections.ts** (`apps/realtime-server/src/routes/databaseConnections.ts`)
   - CRUD роуты для подключений
   - Роут `/execute` для выполнения запросов

3. **validators** (`apps/realtime-server/src/validators/databaseConnections.ts`)
   - Zod схемы валидации

4. **container.ts** - DI контейнер

### Frontend файлы

1. **postgresClient.ts** (`apps/web/src/lib/postgresClient.ts`)
   - API клиент для работы с подключениями

2. **DatabaseConnectionModal.tsx** - модальное окно настройки

3. **DatabaseNode.tsx** - узел на канве

4. **databaseNodeTypes.ts** - типы payload

### Prisma Schema

```prisma
model DatabaseConnection {
  id            String   @id @default(uuid())
  workspaceId   String
  connectionName String
  host          String
  port          Int
  database      String
  username      String
  ssl           Boolean  @default(false)
  secretId      String
  status        String?
  // ... timestamps and relations
}
```

## Рекомендации

### Архитектурное решение

Рекомендуется добавить поле `dbType` (enum: 'postgresql' | 'mysql') в модель DatabaseConnection для различения типов подключений. Это позволит:

- Использовать общие роуты API
- Маршрутизировать запросы к соответствующему сервису
- Расширять поддержку других СУБД в будущем

### Структура сервиса MySQL

```typescript
// mysqlService.ts
import mysql, { Pool, PoolOptions, RowDataPacket } from 'mysql2/promise';

export class MysqlService {
  private pools = new Map<string, Pool>();

  async getPool(connectionId: string): Promise<Pool> { ... }
  async executeQuery(connectionId: string, query: string): Promise<QueryResult> { ... }
  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> { ... }
  async closePool(connectionId: string): Promise<void> { ... }
}
```

### Различия PostgreSQL vs MySQL

| Аспект            | PostgreSQL (pg)                      | MySQL (mysql2)                       |
| ----------------- | ------------------------------------ | ------------------------------------ |
| Порт по умолчанию | 5432                                 | 3306                                 |
| Test query        | `SELECT 1 as test`                   | `SELECT 1 as test`                   |
| SSL опция         | `ssl: { rejectUnauthorized: false }` | `ssl: { rejectUnauthorized: false }` |
| Pool события      | `pool.on('error', ...)`              | Нет аналога (обработка в try/catch)  |
| Результат         | `result.fields`, `result.rows`       | `[rows, fields]` (tuple)             |

### Порядок реализации

1. Добавить `mysql2` в зависимости realtime-server
2. Добавить `dbType` поле в Prisma schema + миграция
3. Создать `mysqlService.ts`
4. Обновить роуты для маршрутизации по dbType
5. Обновить валидаторы (добавить dbType)
6. Обновить frontend: типы, модальное окно, клиент

## Следующие шаги

1. Установить зависимость: `pnpm add mysql2 -F realtime-server`
2. Обновить Prisma schema с enum DatabaseType
3. Запустить миграцию: `pnpm prisma:migrate -F realtime-server`
4. Создать MysqlService по образцу PostgresService
5. Обновить container.ts
6. Обновить роуты databaseConnections.ts
7. Обновить фронтенд компоненты
