#!/usr/bin/env node
// Applies the Supabase migrations and seed to the REMOTE project referenced by
// NEXT_PUBLIC_SUPABASE_URL, using the Supabase Management API.
//
// Requires a Supabase personal access token (starts with "sbp_"), created at
// https://supabase.com/dashboard/account/tokens
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-remote-db.mjs
//
// It runs, in order:
//   supabase/migrations/202607170001_initial_schema.sql
//   supabase/migrations/202607170002_rls_policies.sql
//   supabase/seed.sql   (skip with --no-seed)
//
// The token is read from the environment only and never printed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile() {
  const env = {};
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    // no .env is fine; rely on process.env
  }
  return env;
}

const fileEnv = readEnvFile();
const token =
  process.env.SUPABASE_ACCESS_TOKEN ?? fileEnv.SUPABASE_ACCESS_TOKEN;
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and re-run:\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-remote-db.mjs"
  );
  process.exit(1);
}
const ref = (supabaseUrl ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error(`Could not derive the project ref from ${supabaseUrl}`);
  process.exit(1);
}

const files = [
  "supabase/migrations/202607170001_initial_schema.sql",
  "supabase/migrations/202607170002_rls_policies.sql"
];
if (!process.argv.includes("--no-seed")) files.push("supabase/seed.sql");

async function runSql(label, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  console.log(`OK  ${label}`);
}

console.log(`Applying database to project ${ref}…`);
for (const file of files) {
  const sql = readFileSync(join(root, file), "utf8");
  await runSql(file, sql);
}
console.log("Database setup complete.");
