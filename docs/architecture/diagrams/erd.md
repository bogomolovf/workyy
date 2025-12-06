# Workyy ERD (Stage 1)

## Core Entities

- **User** — владелец аккаунта, может принадлежать нескольким рабочим пространствам.
- **Workspace** — пространство сотрудничества; содержит борды, секреты и политики ретенции.
- **Board** — холст с узлами и рёбрами; принадлежит workspace и опционально owner.
- **Node** — элемент DAG (`sql`, `python`, `table`, `plot`), хранит позицию и payload.
- **Edge** — связь зависимости между узлами.
- **Run** — запуск узла, хранит статус, trigger, Arrow результат/ошибку.
- **Snapshot** — сохранённый артефакт борда (Arrow blob + метаданные).
- **Comment** — комментарии к борду/узлам.
- **Secret** — хранилище соединений рабочих пространств.
- **RetentionPolicy** — политика хранения (борды/рун/снапшоты).
- **AuditEvent** — журнал доменных событий (создание бордов, запуск узлов, результаты run).

## Диаграмма

```mermaid
erDiagram
  User ||--o{ UserWorkspaceRole : memberships
  Workspace ||--o{ UserWorkspaceRole : members
  Workspace ||--|{ Board : boards
  Workspace ||--o{ Secret : secrets
  Workspace ||--o{ RetentionPolicy : policies
  Board ||--o{ Node : nodes
  Board ||--o{ Edge : edges
  Board ||--o{ Run : runs
  Board ||--o{ Snapshot : snapshots
  Board ||--o{ Comment : comments
  Node ||--o{ Run : executions
  Node ||--o{ Comment : annotations
  Edge }o--|| Node : source
  Edge }o--|| Node : target
  Snapshot }o--|| User : author
  Secret }o--|| Workspace : workspace
  RetentionPolicy }o--|| Board : scopedBoard
```
