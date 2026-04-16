#!/usr/bin/env node
/**
 * Back up the SQLite database to a timestamped file.
 *
 * Usage:
 *   node scripts/backup-db.js              # -> data/backups/grid-sprite_20260409-143022.db
 *   node scripts/backup-db.js my-label     # -> data/backups/grid-sprite_my-label.db
 *
 * Uses SQLite's online backup API (safe even while the server is running).
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';

const DB_PATH = resolve('data/grid-sprite.db');
const BACKUP_DIR = resolve('data/backups');

if (!existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const timestamp = process.argv[2]
  || (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  })();

const backupPath = join(BACKUP_DIR, `grid-sprite_${timestamp}.db`);

if (existsSync(backupPath)) {
  console.error(`Backup already exists: ${backupPath}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

try {
  await db.backup(backupPath);
  const sizeMB = (statSync(backupPath).size / 1024 / 1024).toFixed(1);
  console.log(`Backed up to ${backupPath} (${sizeMB} MB)`);
} catch (err) {
  console.error('Backup failed:', err.message);
  process.exit(1);
} finally {
  db.close();
}
