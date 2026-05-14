import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

if (!isConfigured) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set — running in offline / localStorage mode')
}

// Only create the client when both values are present.
// Calling createClient('', '') throws immediately → crashes the app.
export const supabase: SupabaseClient<Database> = isConfigured
  ? createClient<Database>(url!, key!)
  : (null as unknown as SupabaseClient<Database>)   // never accessed when isConfigured = false
