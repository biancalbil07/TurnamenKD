import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';
import { PATEN_SUPABASE_URL, PATEN_SUPABASE_ANON_KEY, supabase as patenClient } from './supabaseClient';

// Default environment credentials or PATEN credentials
const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || PATEN_SUPABASE_URL;
const DEFAULT_SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || PATEN_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export function getSupabaseConfig(): SupabaseConfig {
  const saved = localStorage.getItem('turnamen_kd_supabase_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return {
          ...parsed,
          url: sanitizeUrl(parsed.url),
        };
      }
    } catch {
      // Fallback
    }
  }
  return {
    url: sanitizeUrl(DEFAULT_SUPABASE_URL),
    anonKey: DEFAULT_SUPABASE_KEY,
    enabled: true
  };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  const sanitized = {
    ...config,
    url: sanitizeUrl(config.url)
  };
  localStorage.setItem('turnamen_kd_supabase_config', JSON.stringify(sanitized));
  supabaseInstance = null; // reset client instance
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.enabled || !config.url || !config.anonKey) {
    return patenClient;
  }
  if (!supabaseInstance) {
    try {
      const cleanUrl = sanitizeUrl(config.url);
      if (cleanUrl === PATEN_SUPABASE_URL && config.anonKey === PATEN_SUPABASE_ANON_KEY) {
        supabaseInstance = patenClient;
      } else {
        supabaseInstance = createClient(cleanUrl, config.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
          realtime: { params: { eventsPerSecond: 10 } }
        });
      }
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return patenClient;
    }
  }
  return supabaseInstance;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !key) {
      return { success: false, message: 'URL dan Anon Key harus diisi.' };
    }
    const testClient = createClient(url, key);
    const { error } = await testClient.from('tournaments').select('count', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still connected!
      if (error.message.includes('relation "tournaments" does not exist') || error.code === '42P01') {
        return { success: true, message: 'Koneksi Berhasil! (Tabel belum dibuat, silakan jalankan SQL Schema)' };
      }
      return { success: false, message: `Koneksi gagal: ${error.message}` };
    }
    
    return { success: true, message: 'Koneksi Supabase Berhasil & Tabel Terdeteksi!' };
  } catch (err: any) {
    return { success: false, message: `Terjadi kesalahan: ${err.message || err}` };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- SQL Schema & Setup for Turnamen KD in Supabase
-- Run this in your Supabase SQL Editor:

-- 1. Tournaments Table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  third_place_match BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seed INT DEFAULT 0,
  logo_emoji TEXT DEFAULT '⚽',
  time_slot TEXT DEFAULT '09:00 - 15:00'
);

-- 3. Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  round_name TEXT NOT NULL,
  match_code TEXT NOT NULL,
  team1_id TEXT,
  team2_id TEXT,
  team1_name TEXT DEFAULT 'TBD',
  team2_name TEXT DEFAULT 'TBD',
  team1_score INT,
  team2_score INT,
  winner_id TEXT,
  next_match_id TEXT,
  next_match_slot INT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  venue TEXT DEFAULT 'Lapangan A',
  date TEXT,
  time TEXT,
  time_slot TEXT DEFAULT '09:00 - 15:00',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_third_place BOOLEAN DEFAULT false
);

-- 4. Panitia Members Table
CREATE TABLE IF NOT EXISTS public.panitia_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'anggota',
  phone TEXT,
  division TEXT,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL
);

-- 6. Dynamic Time Slots Table
CREATE TABLE IF NOT EXISTS public.time_slots (
  id TEXT PRIMARY KEY,
  slot_label TEXT UNIQUE NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Telegram Settings Table (Supports Group Topics / Threads)
CREATE TABLE IF NOT EXISTS public.telegram_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  bot1_token TEXT,
  bot1_chat_id TEXT,
  bot1_topic_id TEXT,
  bot1_enabled BOOLEAN DEFAULT false,
  auto_notify_score BOOLEAN DEFAULT true,
  auto_notify_schedule BOOLEAN DEFAULT true,
  bot2_token TEXT,
  bot2_chat_id TEXT,
  bot2_topic_id TEXT,
  bot2_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration support for existing telegram_settings tables
ALTER TABLE public.telegram_settings ADD COLUMN IF NOT EXISTS bot1_topic_id TEXT;
ALTER TABLE public.telegram_settings ADD COLUMN IF NOT EXISTS bot2_topic_id TEXT;

-- Enable Realtime safely & idempotently (No duplicate relation error!)
DO $$ 
DECLARE 
  tbl TEXT;
  tbls TEXT[] := ARRAY['tournaments', 'teams', 'matches', 'panitia_members', 'audit_logs', 'time_slots', 'telegram_settings'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- Disable Row Level Security (RLS) and grant permissions for easy panitia & cross-browser management
ALTER TABLE public.tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.panitia_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_settings DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- 8. Default Seed Data
INSERT INTO public.panitia_members (id, name, username, password, role, phone, division, status)
VALUES 
  ('panitia_master', 'Mas Ageng (Master Admin)', 'admin', '123', 'master', '081234567890', 'Koordinator Utama', 'active'),
  ('panitia_field', 'Mas Rian (Panitia Lapangan)', 'panitia', '123', 'anggota', '089876543210', 'Seksi Lapangan & Skor', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.time_slots (id, slot_label, is_default)
VALUES 
  ('slot_1', '09:00 - 15:00', true),
  ('slot_2', '16:00 - 22:00', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.telegram_settings (id, bot1_enabled, bot2_enabled, auto_notify_score, auto_notify_schedule)
VALUES ('default', false, false, true, true)
ON CONFLICT (id) DO NOTHING;
`;
