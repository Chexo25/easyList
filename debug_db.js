import { supabase } from './src/lib/supabase.js';

async function run() {
  const { data, error } = await supabase.from('items').select('*').limit(1);
  console.log("Data:", data, "Error:", error);
}

run();
