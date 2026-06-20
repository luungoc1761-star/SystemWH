import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ayxhdqaendspvdxibayh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eGhkcWFlbmRzcHZkeGliYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDAzMDQsImV4cCI6MjA5NTUxNjMwNH0.MOmERW-oVJitj6fAB85439_nxqeyYMQhQ5rYr8TF-Fc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
