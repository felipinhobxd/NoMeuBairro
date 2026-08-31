import { createClient } from '@supabase/supabase-js';
import { monitoredFetch } from './productionMonitoring';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Prefer Supabase's modern publishable key, but keep the legacy anon key
// as a backwards-compatible fallback for existing Vercel environments.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  global: { fetch: monitoredFetch },
});
