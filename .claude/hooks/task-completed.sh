#!/bin/bash
# Quality gate: проверяет что тиммейт выполнил базовые проверки перед завершением задачи
# Exit 0 = задача завершена, exit 2 = отправить фидбек и продолжить работу

INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name // "lead"')
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // "unknown"')

# Проверяем наличие console.log для отладки (кроме console.error/warn)
DEBUG_LOGS=$(grep -rn 'console\.log' apps/web/src/ apps/realtime-server/src/ 2>/dev/null | grep -v node_modules | grep -v '.test.' | grep -v '\.next/' | head -5)
if [ -n "$DEBUG_LOGS" ]; then
  echo "Найдены console.log в продакшен коде. Удали перед завершением:" >&2
  echo "$DEBUG_LOGS" >&2
  exit 2
fi

# Проверяем наличие диагностических логов [DIAG:*]
DIAG_LOGS=$(grep -rn '\[DIAG:' apps/web/src/ apps/realtime-server/src/ 2>/dev/null | grep -v node_modules | head -5)
if [ -n "$DIAG_LOGS" ]; then
  echo "Найдены диагностические логи [DIAG:*]. Удали перед завершением:" >&2
  echo "$DIAG_LOGS" >&2
  exit 2
fi

# Проверяем merge conflict маркеры
CONFLICTS=$(grep -rn '<<<<<<<\|>>>>>>>\|=======' apps/web/src/ apps/realtime-server/src/ packages/core-domain/src/ 2>/dev/null | grep -v node_modules | head -5)
if [ -n "$CONFLICTS" ]; then
  echo "Найдены merge conflict маркеры. Разреши конфликты:" >&2
  echo "$CONFLICTS" >&2
  exit 2
fi

echo "Quality gate passed for task: $TASK_SUBJECT (by $TEAMMATE)"
exit 0
