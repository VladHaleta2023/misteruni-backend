#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres.vedyjucfxikmlnljzbjg:123MisterUni123%40@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

console.log(`📦 Создание бэкапа...`);

try {
    execSync(
        `pg_dump "${DIRECT_URL}" --format=custom --no-owner -f "${BACKUP_DIR}/backup_${timestamp}.dump"`,
        { stdio: 'inherit' }
    );
    console.log(`✅ Бэкап создан: backup_${timestamp}.dump`);
} catch (error) {
    console.error(`❌ Ошибка:`, error.message);
    process.exit(1);
}