import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const environmentPath = resolve('src/environments/environment.ts');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Local development can keep using its ignored environment file. Cloud builds
// provide both values and generate a clean file just before Angular compiles.
if (!supabaseUrl && !supabaseAnonKey) {
  try {
    await readFile(environmentPath, 'utf8');
    process.exit(0);
  } catch {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY in the build environment.'
    );
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Both SUPABASE_URL and SUPABASE_ANON_KEY are required.');
}

const source = `export const environment = ${JSON.stringify(
  {
    production: true,
    supabase: { url: supabaseUrl, anonKey: supabaseAnonKey },
  },
  null,
  2
)};\n`;

await mkdir(dirname(environmentPath), { recursive: true });
await writeFile(environmentPath, source, 'utf8');
