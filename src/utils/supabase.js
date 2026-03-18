import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  "https://xdbxcdxexnvwjaniazaf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkYnhjZHhleG52d2phbmlhemFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjUxNDEsImV4cCI6MjA4OTM0MTE0MX0.g_z-VH-X4MY5dEUqVY8OxZ1k7rU2JryPZebzGsm_zOg"
)