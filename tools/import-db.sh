#!/usr/bin/env bash
# ============================================================================
# ExamLegacy — One-Command Database Setup & Import Script
# ============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$DIR/database.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Error: $SQL_FILE not found!"
  exit 1
fi

echo "======================================================"
echo "  ExamLegacy — Database Setup & Import"
echo "  Powered by SANJAYXLEGACY"
echo "======================================================"

# Read credentials from .env
if [ -f "$DIR/.env" ]; then
  DB_HOST=$(grep -E '^DB_HOST=' "$DIR/.env" | cut -d '=' -f2- | tr -d ' "\r')
  DB_PORT=$(grep -E '^DB_PORT=' "$DIR/.env" | cut -d '=' -f2- | tr -d ' "\r')
  DB_NAME=$(grep -E '^DB_NAME=' "$DIR/.env" | cut -d '=' -f2- | tr -d ' "\r')
  DB_USER=$(grep -E '^DB_USER=' "$DIR/.env" | cut -d '=' -f2- | tr -d ' "\r')
  DB_PASS=$(grep -E '^DB_PASS=' "$DIR/.env" | cut -d '=' -f2- | tr -d ' "\r')
fi

DB_HOST=${DB_HOST:-"127.0.0.1"}
DB_PORT=${DB_PORT:-"3306"}
DB_NAME=${DB_NAME:-"examlegacy"}
DB_USER=${DB_USER:-"root"}

PASS_ARG=""
if [ -n "$DB_PASS" ]; then
  PASS_ARG="-p$DB_PASS"
fi

echo "Connecting to MariaDB/MySQL at $DB_USER@$DB_HOST:$DB_PORT..."

if command -v mariadb >/dev/null 2>&1; then
  mariadb -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" $PASS_ARG < "$SQL_FILE"
elif command -v mysql >/dev/null 2>&1; then
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" $PASS_ARG < "$SQL_FILE"
else
  echo "❌ Error: Neither mariadb nor mysql command line client was found."
  exit 1
fi

echo "✅ ExamLegacy database imported successfully into '$DB_NAME'!"
