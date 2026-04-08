import { createClient } from '@supabase/supabase-js';
const supabase = createClient('http://localhost:8000', 'apikey');
const channel = supabase.channel('test');
const res = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'items'}, () => {}).subscribe();
console.log(res === channel, typeof res);
process.exit(0);
