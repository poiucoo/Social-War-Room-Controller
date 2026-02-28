import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iopleynulnrlabfojlab.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GmsMH3tEwUhZyNCHCjPeMg_5FfBlUuc';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Anon Key is missing. Please setup your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
