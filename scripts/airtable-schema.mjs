#!/usr/bin/env node
/**
 * Print the Airtable base's tables and fields so worker/airtable/fieldMap.ts can
 * be kept in sync with the real base. Reads AIRTABLE_TOKEN from .dev.vars.
 *
 *   npm run airtable:schema
 */
import { readFileSync } from 'node:fs';

const BASE_ID = 'appFtt4DomwAITJTa';

function readToken() {
  try {
    const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
    return vars.match(/^AIRTABLE_TOKEN=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

const token = process.env.AIRTABLE_TOKEN || readToken();
if (!token) {
  console.error('No AIRTABLE_TOKEN found. Add it to .dev.vars (see .dev.vars.example).');
  process.exit(1);
}

const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`Airtable ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const { tables } = await res.json();
const names = Object.fromEntries(tables.map((t) => [t.id, t.name]));
for (const table of tables) {
  console.log(`\n${table.name}  (${table.id})`);
  for (const field of table.fields) {
    const link = field.options?.linkedTableId ? ` → ${names[field.options.linkedTableId]}` : '';
    console.log(`  - ${field.name}  [${field.type}${link}]`);
  }
}
