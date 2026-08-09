export type Role = 'master' | 'anggota';

export type TournamentCategory = 'Futsal' | 'Badminton' | 'Esports' | 'Mini Soccer' | 'Voli' | 'Basket' | 'Lainnya';

export interface Tournament {
  id: string;
  name: string;
  category: TournamentCategory;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  third_place_match?: boolean; // Whether to generate 3rd place match
  start_date?: string; // e.g. '2026-08-10'
  end_date?: string;   // e.g. '2026-08-16'
}

export interface TimeSlot {
  id: string;
  slot_label: string;
  is_default?: boolean;
  created_at?: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  seed?: number;
  logo_emoji?: string;
  time_slot?: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  round_name: string;
  match_code: string;
  team1_id: string | null;
  team2_id: string | null;
  team1_name: string;
  team2_name: string;
  team1_score: number | null;
  team2_score: number | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_match_slot: 1 | 2 | null;
  status: 'scheduled' | 'live' | 'completed' | 'bye';
  venue: string;
  date: string;
  time: string;
  time_slot?: string;
  updated_at: string;
  is_third_place?: boolean;
}

export interface PanitiaMember {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  phone: string;
  division: string;
  status: 'active' | 'inactive';
  joined_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_name: string;
  user_role: string;
  action: string;
  details: string;
}

export interface TelegramSettings {
  // Bot 1: Report Hasil Pertandingan (Text)
  bot1_token: string;
  bot1_chat_id: string;
  bot1_topic_id?: string;
  bot1_enabled: boolean;
  auto_notify_score: boolean;
  auto_notify_schedule: boolean;

  // Bot 2: Report Update Bagan (Image/PNG)
  bot2_token: string;
  bot2_chat_id: string;
  bot2_topic_id?: string;
  bot2_enabled: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}
