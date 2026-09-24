import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hsckgramsgokjtvcymhv.supabase.co'
const supabaseAnonKey = 'sb_publishable_a9BOUjYmfa2XId79ma_x9Q_xRksM9TZ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Helper to check if tables exist
export const checkTables = async () => {
  const { error } = await supabase.from('beahead_cars').select('id').limit(1)
  if (error && error.code === 'PGRST205') {
    return false
  }
  return true
}
