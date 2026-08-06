import { createClient } from '@supabase/supabase-js';

// Credentials Paten Supabase Cloud
export const PATEN_SUPABASE_URL = "https://kalipypqwzkravouxncs.supabase.co";
export const PATEN_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbGlweXBxd3prcmF2b3V4bmNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTgyMTAsImV4cCI6MjEwMTU5NDIxMH0.rJzL5H5YN1RGHMB-YwsC8IyAqTwBq3Efja5KvDJnvgI";

export const supabase = createClient(PATEN_SUPABASE_URL, PATEN_SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
