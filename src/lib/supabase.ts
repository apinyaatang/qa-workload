import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set — running in offline mode')
}

export const supabase = createClient<Database>(url ?? '', key ?? '')
export const isConfigured = Boolean(url && key)
