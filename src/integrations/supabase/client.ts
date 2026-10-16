import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { readSupabaseConfig } from '@/lib/supabase-config';

const config = readSupabaseConfig(import.meta.env);
export const SUPABASE_URL = config.url;
export const SUPABASE_PUBLISHABLE_KEY = config.key;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
