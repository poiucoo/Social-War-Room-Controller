import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iopleynulnrlabfojlab.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvcGxleW51bG5ybGFiZm9qbGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjEzODIsImV4cCI6MjA4MTI5NzM4Mn0.xqx6x4dJuDFE95ivnwILXf7PC9G2GgQlW7ckedemb9I';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Anon Key is missing. Please setup your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
