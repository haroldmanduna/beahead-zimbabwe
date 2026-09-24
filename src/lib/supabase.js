import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://clqqnipibcnouwinzbuc.supabase.co'
const supabaseAnonKey = 'sb_publishable_AZJtat5-kvLSIPt9o_ChKA_veXLms5D'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Check if tables exist - now they do!
export const checkTables = async () => {
  const { error } = await supabase.from('beahead_cars').select('id').limit(1)
  if (error && error.code === 'PGRST205') {
    return false
  }
  return true
}
