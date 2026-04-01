import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envCode = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const urlMatch = envCode.match(/import\.meta\.env\.VITE_SUPABASE_URL/);

// Actually, I can't read import.meta.env from node easily. Let's read .env file.
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1];

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('items').select('*').limit(1);
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Record keys:", data.length ? Object.keys(data[0]) : "No data but table exists");
  }
}
run();
