#!/usr/bin/env node
// One-time backup of the live Supabase project before an RLS security lockdown.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DEST = '/Volumes/Crucial X9/Developer/CheckVerify-backups/2026-09-07';
const PROJECT_REF = 'nwctkkdmbczpyhwqqonc';
const EXPECTED = {
  reservations: 181,
  verification_documents: 183,
  digital_signatures: 181,
  storage: { total: 469, 'id-documents': 233, 'credit-cards': 236 },
};

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

const env = parseEnv(await readFile(path.resolve(process.cwd(), '.env'), 'utf8'));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const KEY_TYPE = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon';
if (!SUPABASE_URL || !API_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const authHeaders = (extra = {}) => ({ apikey: API_KEY, Authorization: `Bearer ${API_KEY}`, ...extra });
const mismatches = [];
const downloadFailures = [];
const checkCount = (label, actual, expected) => {
  if (Math.abs(actual - expected) > 2) mismatches.push(`${label}: expected ${expected}, got ${actual}`);
};

async function fetchTable(table) {
  const rows = [];
  let start = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.asc`, {
      headers: authHeaders({ Range: `${start}-${start + 999}`, Prefer: 'count=exact' }),
    });
    if (!res.ok && res.status !== 206) throw new Error(`GET ${table} failed: ${res.status} ${res.statusText}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
    start += 1000;
  }
  return rows;
}

async function backupTables() {
  await mkdir(path.join(DEST, 'tables'), { recursive: true });
  const counts = {};
  for (const table of ['reservations', 'verification_documents', 'digital_signatures']) {
    const rows = await fetchTable(table);
    await writeFile(path.join(DEST, 'tables', `${table}.json`), JSON.stringify(rows, null, 2));
    counts[table] = rows.length;
    checkCount(table, rows.length, EXPECTED[table]);
    console.log(`  tables/${table}.json: ${rows.length} rows`);
  }
  return counts;
}

async function listStorageFolder(folder) {
  const objects = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/documents`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: folder, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${folder} failed: ${res.status} ${res.statusText}`);
    const batch = await res.json();
    objects.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return objects;
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function downloadObject(folder, item) {
  const objectPath = `${folder}/${item.name}`;
  const localPath = path.join(DEST, 'storage', 'documents', objectPath);
  await mkdir(path.dirname(localPath), { recursive: true });
  const expectedSize = item.metadata?.size;

  let needsDownload = true;
  try {
    const st = await stat(localPath);
    if (expectedSize != null && st.size === expectedSize) needsDownload = false;
  } catch {}

  if (needsDownload) {
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/documents/${objectPath}`, { headers: authHeaders() });
    if (!res.ok && (res.status === 400 || res.status === 403)) {
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/documents/${objectPath}`, { headers: authHeaders() });
    }
    if (!res.ok) {
      downloadFailures.push(`${objectPath}: HTTP ${res.status}`);
      return null;
    }
    await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }

  const data = await readFile(localPath);
  return { path: objectPath, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}

async function backupStorage() {
  const perFolder = {};
  const files = [];
  for (const folder of ['id-documents', 'credit-cards']) {
    const items = await listStorageFolder(folder);
    perFolder[folder] = items.length;
    checkCount(`storage ${folder}`, items.length, EXPECTED.storage[folder]);
    console.log(`  storage/documents/${folder}: ${items.length} objects listed`);
    (await pool(items, 6, (item) => downloadObject(folder, item))).forEach((r) => r && files.push(r));
  }
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  checkCount('storage total', files.length, EXPECTED.storage.total);
  return { object_count: files.length, total_bytes: totalBytes, per_folder: perFolder, files };
}

async function main() {
  console.log(`Backing up ${PROJECT_REF} (key_type=${KEY_TYPE}) to ${DEST}`);
  const tables = await backupTables();
  const storage = await backupStorage();

  const manifest = {
    generated_at: new Date().toISOString(),
    source_project_ref: PROJECT_REF,
    key_type: KEY_TYPE,
    tables,
    storage,
    expected: EXPECTED,
    mismatches,
  };
  await writeFile(path.join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n--- Summary ---');
  for (const [t, c] of Object.entries(tables)) console.log(`${t}: ${c} rows`);
  console.log(
    `storage: ${storage.object_count} objects (id-documents ${storage.per_folder['id-documents']}, credit-cards ${storage.per_folder['credit-cards']}), ${storage.total_bytes} bytes`
  );
  if (downloadFailures.length) {
    console.error(`\n${downloadFailures.length} DOWNLOAD FAILURE(S):`);
    downloadFailures.forEach((f) => console.error(`  ${f}`));
  }
  if (mismatches.length) {
    console.error(`\n${mismatches.length} COUNT MISMATCH(ES):`);
    mismatches.forEach((m) => console.error(`  ${m}`));
  }
  if (downloadFailures.length || mismatches.length) {
    console.error('\nBACKUP COMPLETED WITH ERRORS — see above.');
    process.exit(1);
  }
  console.log('\nBackup completed successfully.');
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
