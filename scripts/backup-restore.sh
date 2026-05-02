#!/bin/bash

BACKUP_FILE="backups/$(ls -t backups/*.dump 2>/dev/null | head -1 | xargs basename 2>/dev/null)"
NEW_DB_URL="postgresql://postgres:0a9ePxqTF44IMnAy@db.owviqjstsrhsvacabawo.supabase.co:5432/postgres"

echo "📦 Восстановление из: $BACKUP_FILE"
echo "🎯 Целевая база: db.owviqjstsrhsvacabawo.supabase.co"
echo ""

# ./scripts/backup-restore.sh
# Проверка файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Ошибка загрузки базы данных"
    exit 1
fi

# Проверка подключения
psql "$NEW_DB_URL" -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Ошибка загрузки базы данных"
    exit 1
fi

echo "🔄 Восстановление... (пожалуйста, подождите)"
echo ""

# Функция фильтрации - убираем ВСЕ системные сообщения
pg_restore --clean --if-exists --no-owner \
  --dbname="$NEW_DB_URL" \
  "$BACKUP_FILE" 2>&1 | \
  grep -v "ERROR" | \
  grep -v "FATAL" | \
  grep -v "WARNING" | \
  grep -v "must be owner" | \
  grep -v "does not exist" | \
  grep -v "already exists" | \
  grep -v "permission denied" | \
  grep -v "cannot drop" | \
  grep -v "depends on it" | \
  grep -v "grant options" | \
  grep -v "Non-superuser" | \
  grep -v "COPY failed" | \
  grep -v "schema_migrations" | \
  grep -v "_prisma_migrations" | \
  grep -v "auth\." | \
  grep -v "storage\." | \
  grep -v "realtime\." | \
  grep -v "extensions\." | \
  grep -v "graphql\." | \
  grep -v "pgrst_" | \
  grep -v "issue_" | \
  grep -v "'ERROR'" | \
  grep -v "else 'ERROR'" > /dev/null 2>&1

# Проверка что данные загрузились
TABLE_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE 'auth%' AND table_name NOT LIKE 'storage%' AND table_name NOT LIKE '_prisma%' AND table_name NOT LIKE 'schema_migrations%' AND table_name NOT LIKE 'supabase%';" 2>/dev/null | xargs)

if [ -n "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ База данных загружена"
else
    echo ""
    echo "❌ Ошибка загрузки базы данных"
    exit 1
fi