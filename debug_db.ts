import { supabase } from './src/lib/supabase.ts';

async function run() {
  const { data, error } = await supabase.from('items').select('*').limit(1);
  console.log("Items table:", data, "Error:", error);
}
run();
