#!/usr/bin/env node
// Phase 2 prep: copy digital_signatures.signature_data (base64 PNG data URLs)
// into Supabase Storage + a verification_documents(kind='signature') row.
// Node 22, no deps. Idempotent — skips any verification that already has a
// signature document. `--dry-run` prints counts without writing anything.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');

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

const fileEnv = parseEnv(await readFile(path.resolve(process.cwd(), '.env'), 'utf8').catch(() => ''));
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL (checked process.env and .env).');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in the environment. Set it (never commit it) and re-run.');
  process.exit(1);
}

const authHeaders = (extra = {}) => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra });

async function fetchAllSignatures() {
  const rows = [];
  let start = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/digital_signatures?select=id,reservation_id,signature_data&order=created_at.asc`,
      { headers: authHeaders({ Range: `${start}-${start + 999}` }) }
    );
    if (!res.ok && res.status !== 206) throw new Error(`GET digital_signatures failed: ${res.status} ${res.statusText}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
    start += 1000;
  }
  return rows;
}

async function findVerification(reservationId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/verifications?reservation_id=eq.${reservationId}&select=id,org_id&limit=1`,
    { headers: authHeaders() }
  );
  // Never read a non-2xx body as "no rows": that would silently skip every
  // signature (and, in hasSignatureDoc, re-insert duplicates).
  if (!res.ok) throw new Error(`GET verifications failed: ${res.status} ${res.statusText}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function hasSignatureDoc(verificationId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/verification_documents?verification_id=eq.${verificationId}&kind=eq.signature&select=id&limit=1`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`GET verification_documents failed: ${res.status} ${res.statusText}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const signatures = await fetchAllSignatures();
  console.log(`Found ${signatures.length} digital_signatures rows.${DRY_RUN ? ' (dry run)' : ''}`);

  let migrated = 0;
  let alreadyMigrated = 0;
  let noVerification = 0;
  let failed = 0;

  for (const sig of signatures) {
    if (!sig.reservation_id) { noVerification++; continue; }

    const verification = await findVerification(sig.reservation_id);
    if (!verification) { noVerification++; continue; }

    if (await hasSignatureDoc(verification.id)) { alreadyMigrated++; continue; }

    if (DRY_RUN) { migrated++; continue; }

    const base64 = sig.signature_data.includes(',') ? sig.signature_data.split(',')[1] : sig.signature_data;
    const buffer = Buffer.from(base64, 'base64');
    const storagePath = `signatures/${sig.reservation_id}.png`;

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${storagePath}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'image/png', 'x-upsert': 'true' }),
      body: buffer,
    });
    if (!upload.ok) {
      console.error(`  upload failed (reservation ${sig.reservation_id}): ${upload.status} ${upload.statusText}`);
      failed++;
      continue;
    }

    const insert = await fetch(`${SUPABASE_URL}/rest/v1/verification_documents`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({
        // Link only via verification_id, NOT reservation_id: a second row keyed
        // by reservation_id would break both legacy admin UIs, which assume one
        // verification_documents row per reservation. Cascade still cleans it up
        // (reservations -> verifications -> verification_documents).
        org_id: verification.org_id,
        verification_id: verification.id,
        kind: 'signature',
        storage_backend: 'supabase',
        storage_path: storagePath,
        bytes: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        status: 'pending',
      }),
    });
    if (!insert.ok) {
      console.error(`  insert failed (reservation ${sig.reservation_id}): ${insert.status} ${insert.statusText}`);
      failed++;
      continue;
    }

    migrated++;
  }

  console.log(
    `\n${DRY_RUN ? '[dry-run] would migrate' : 'migrated'}: ${migrated}, already migrated: ${alreadyMigrated}, ` +
      `no verification found: ${noVerification}, failed: ${failed}`
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
