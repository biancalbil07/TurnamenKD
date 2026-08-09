import { AuditLog, Match, PanitiaMember, Team, TimeSlot, Tournament } from '../types';
import { generateKnockoutMatches } from './bracketEngine';
import { getSupabaseClient } from './supabase';
import { syncTelegramSettingsFromSupabase } from './telegram';

// BroadcastChannel for instant cross-tab real-time sync
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('turnamen_kd_realtime_channel')
  : null;

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: 'slot_1', slot_label: '09:00 - 15:00', is_default: true, created_at: new Date().toISOString() },
  { id: 'slot_2', slot_label: '16:00 - 22:00', is_default: true, created_at: new Date().toISOString() },
];

// Initial Seeds
const DEFAULT_TOURNAMENT: Tournament = {
  id: 'tourn_kd_futsal_2026',
  name: 'KD Futsal Cup 2026',
  category: 'Futsal',
  status: 'active',
  created_at: new Date().toISOString(),
  third_place_match: true,
  start_date: '2026-08-10',
  end_date: '2026-08-16',
};

const DEFAULT_TEAMS: Team[] = [
  { id: 'team_1', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Garuda FC', seed: 1, logo_emoji: '🦅', time_slot: '09:00 - 15:00' },
  { id: 'team_2', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Persib Muda', seed: 2, logo_emoji: '🔵', time_slot: '09:00 - 15:00' },
  { id: 'team_3', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Arema Thunder', seed: 3, logo_emoji: '⚡', time_slot: '09:00 - 15:00' },
  { id: 'team_4', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Persebaya Blitz', seed: 4, logo_emoji: '🟢', time_slot: '09:00 - 15:00' },
  { id: 'team_5', tournament_id: DEFAULT_TOURNAMENT.id, name: 'PSM Makassar', seed: 5, logo_emoji: '🔴', time_slot: '16:00 - 22:00' },
  { id: 'team_6', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Bali United Stars', seed: 6, logo_emoji: '🌴', time_slot: '16:00 - 22:00' },
  { id: 'team_7', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Sriwijaya Dragons', seed: 7, logo_emoji: '🐉', time_slot: '16:00 - 22:00' },
  { id: 'team_8', tournament_id: DEFAULT_TOURNAMENT.id, name: 'Persija Strikers', seed: 8, logo_emoji: '🐯', time_slot: '16:00 - 22:00' },
];

const DEFAULT_MEMBERS: PanitiaMember[] = [
  {
    id: 'panitia_master',
    name: 'Mas Ageng (Master Admin)',
    username: 'admin',
    password: '123',
    role: 'master',
    phone: '081234567890',
    division: 'Koordinator Utama',
    status: 'active',
    joined_at: new Date().toISOString(),
  },
  {
    id: 'panitia_field',
    name: 'Mas Rian (Panitia Lapangan)',
    username: 'panitia',
    password: '123',
    role: 'anggota',
    phone: '089876543210',
    division: 'Seksi Lapangan & Skor',
    status: 'active',
    joined_at: new Date().toISOString(),
  },
];

// Memory State
let appData = {
  tournaments: [] as Tournament[],
  teams: [] as Team[],
  matches: [] as Match[],
  panitiaMembers: [] as PanitiaMember[],
  auditLogs: [] as AuditLog[],
  timeSlots: [] as TimeSlot[],
  activeTournamentId: DEFAULT_TOURNAMENT.id,
};

// Storage Keys
const STORAGE_KEY = 'turnamen_kd_app_data_v2';

// Real-time Event Subscriptions
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeDataChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
  }
}

if (broadcastChannel) {
  broadcastChannel.onmessage = (evt) => {
    if (evt.data?.type === 'DATA_UPDATED') {
      loadFromLocalStorage();
      listeners.forEach((l) => l());
    }
  };
}

/**
 * Initialize DB from LocalStorage or Supabase
 */
export async function initDatabase() {
  loadFromLocalStorage();

  // If local data is empty, seed defaults!
  if (appData.tournaments.length === 0) {
    appData.tournaments = [DEFAULT_TOURNAMENT];
    appData.teams = DEFAULT_TEAMS;
    appData.matches = generateKnockoutMatches(
      DEFAULT_TOURNAMENT.id,
      DEFAULT_TEAMS,
      true,
      false,
      DEFAULT_TIME_SLOTS,
      DEFAULT_TOURNAMENT.start_date || '2026-08-10',
      DEFAULT_TOURNAMENT.end_date || '2026-08-16'
    );
    appData.panitiaMembers = DEFAULT_MEMBERS;
    appData.timeSlots = DEFAULT_TIME_SLOTS;
    appData.auditLogs = [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_name: 'System',
        user_role: 'master',
        action: 'INIT_SYSTEM',
        details: 'Sistem Turnamen KD berhasil diinisialisasi.',
      },
    ];
    saveToLocalStorage();
  }

  if (!appData.timeSlots || appData.timeSlots.length === 0) {
    appData.timeSlots = DEFAULT_TIME_SLOTS;
    saveToLocalStorage();
  }

  // Try sync with Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await syncFromSupabase();
      subscribeSupabaseRealtime();
    } catch (err) {
      console.warn('Supabase sync warning:', err);
    }
  }
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appData = {
        tournaments: parsed.tournaments || [],
        teams: parsed.teams || [],
        matches: parsed.matches || [],
        panitiaMembers: parsed.panitiaMembers || [],
        auditLogs: parsed.auditLogs || [],
        timeSlots: parsed.timeSlots && parsed.timeSlots.length > 0 ? parsed.timeSlots : DEFAULT_TIME_SLOTS,
        activeTournamentId: parsed.activeTournamentId || DEFAULT_TOURNAMENT.id,
      };
    } catch (e) {
      console.error('Failed to parse local storage data', e);
    }
  }
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// -------------------------------------------------------------
// SUPABASE SYNC LOGIC
// -------------------------------------------------------------
let realtimeConnectionState = 'DISCONNECTED';

export function getRealtimeConnectionStatus() {
  const supabase = getSupabaseClient();
  if (!supabase) return { connected: false, status: 'NO_SUPABASE' };
  return {
    connected: realtimeConnectionState === 'SUBSCRIBED',
    status: realtimeConnectionState,
  };
}

export async function syncFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const [tRes, teRes, mRes, pRes, aRes, tsRes] = await Promise.all([
      supabase.from('tournaments').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('panitia_members').select('*'),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50),
      supabase.from('time_slots').select('*').order('created_at', { ascending: true }),
    ]);

    // Handle Panitia Members Sync
    if (pRes.error) {
      console.error('[SUPABASE SYNC ERROR] panitia_members:', pRes.error.message, pRes.error);
    } else if (pRes.data && pRes.data.length > 0) {
      appData.panitiaMembers = pRes.data;
    } else if (pRes.data && pRes.data.length === 0) {
      if (appData.panitiaMembers.length > 0) {
        console.log('[SUPABASE SYNC] Tabel panitia_members di Supabase kosong. Syncing local members to Supabase...');
        await supabase.from('panitia_members').upsert(appData.panitiaMembers);
      } else {
        console.log('[SUPABASE SYNC] Tabel panitia_members di Supabase kosong. Menginisialisasi user default (admin/panitia)...');
        appData.panitiaMembers = DEFAULT_MEMBERS;
        await supabase.from('panitia_members').upsert(DEFAULT_MEMBERS);
      }
    }

    // Handle Tournaments Sync
    if (tRes.error) {
      console.error('[SUPABASE SYNC ERROR] tournaments:', tRes.error.message);
    } else if (tRes.data && tRes.data.length > 0) {
      appData.tournaments = tRes.data;
    } else if (tRes.data && tRes.data.length === 0) {
      if (appData.tournaments.length > 0) {
        await supabase.from('tournaments').upsert(appData.tournaments);
      } else {
        appData.tournaments = [DEFAULT_TOURNAMENT];
        await supabase.from('tournaments').upsert([DEFAULT_TOURNAMENT]);
      }
    }

    // Handle Teams & Matches Sync
    if (teRes.error) console.error('[SUPABASE SYNC ERROR] teams:', teRes.error.message);
    else if (teRes.data && teRes.data.length > 0) appData.teams = teRes.data;

    if (mRes.error) console.error('[SUPABASE SYNC ERROR] matches:', mRes.error.message);
    else if (mRes.data && mRes.data.length > 0) appData.matches = mRes.data;

    if (aRes.error) console.error('[SUPABASE SYNC ERROR] audit_logs:', aRes.error.message);
    else if (aRes.data && aRes.data.length > 0) appData.auditLogs = aRes.data;

    // Handle Time Slots Sync
    if (tsRes.error) {
      console.error('[SUPABASE SYNC ERROR] time_slots:', tsRes.error.message);
    } else if (tsRes.data && tsRes.data.length > 0) {
      appData.timeSlots = tsRes.data;
    } else if (tsRes.data && tsRes.data.length === 0) {
      appData.timeSlots = DEFAULT_TIME_SLOTS;
      await supabase.from('time_slots').upsert(DEFAULT_TIME_SLOTS);
    }

    await syncTelegramSettingsFromSupabase();

    saveToLocalStorage();
    notifyListeners();
  } catch (err) {
    console.error('[SUPABASE SYNC EXCEPTION]', err);
  }
}

let realtimeChannelSubscription: any = null;

function subscribeSupabaseRealtime() {
  const supabase = getSupabaseClient();
  if (!supabase || realtimeChannelSubscription) return;

  realtimeConnectionState = 'CONNECTING';
  notifyListeners();

  realtimeChannelSubscription = supabase
    .channel('public:realtime-turnamen-channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      console.log('⚡ [SUPABASE REALTIME EVENT]', payload.table, payload.eventType);
      syncFromSupabase();
    })
    .subscribe((status) => {
      console.log('⚡ [SUPABASE REALTIME CHANNEL STATUS]', status);
      realtimeConnectionState = status;
      notifyListeners();
    });
}

/**
 * Upsert helper to Supabase + LocalStorage
 */
async function autoUpsert(table: string, data: any[]) {
  saveToLocalStorage();
  notifyListeners();

  const supabase = getSupabaseClient();
  if (supabase && data.length > 0) {
    try {
      const { error } = await supabase.from(table).upsert(data);
      if (error) {
        console.error(`[SUPABASE UPSERT ERROR] Table: ${table}:`, error.message, error);
      } else {
        console.log(`[SUPABASE UPSERT SUCCESS] ${data.length} item(s) to ${table}`);
      }
    } catch (err) {
      console.warn(`[SUPABASE UPSERT EXCEPTION] Table ${table}:`, err);
    }
  }
}

async function autoDelete(table: string, filterKey: string, filterVal: string) {
  saveToLocalStorage();
  notifyListeners();

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from(table).delete().eq(filterKey, filterVal);
      if (error) {
        console.error(`[SUPABASE DELETE ERROR] Table: ${table}:`, error.message, error);
      } else {
        console.log(`[SUPABASE DELETE SUCCESS] Table ${table} where ${filterKey}=${filterVal}`);
      }
    } catch (err) {
      console.warn(`[SUPABASE DELETE EXCEPTION] Table ${table}:`, err);
    }
  }
}

// -------------------------------------------------------------
// DATA ACCESSORS & MUTATORS
// -------------------------------------------------------------

export function getAppData() {
  return appData;
}

export function getActiveTournament(): Tournament | undefined {
  return appData.tournaments.find((t) => t.id === appData.activeTournamentId) || appData.tournaments[0];
}

export function setActiveTournamentId(id: string) {
  appData.activeTournamentId = id;
  saveToLocalStorage();
  notifyListeners();
}

export async function addTournament(tournament: Tournament, initialTeams: Team[], currentUser: { name: string; role: string }) {
  if (!tournament.start_date) tournament.start_date = '2026-08-10';
  if (!tournament.end_date) tournament.end_date = '2026-08-16';

  appData.tournaments.unshift(tournament);
  appData.activeTournamentId = tournament.id;

  if (initialTeams.length > 0) {
    appData.teams.push(...initialTeams);
    const matches = generateKnockoutMatches(
      tournament.id,
      initialTeams,
      tournament.third_place_match,
      false,
      appData.timeSlots,
      tournament.start_date,
      tournament.end_date
    );
    appData.matches.push(...matches);
  }

  logAudit(currentUser.name, currentUser.role, 'CREATE_TOURNAMENT', `Membuat turnamen baru: "${tournament.name}" (${initialTeams.length} tim)`);

  await autoUpsert('tournaments', [tournament]);
  if (initialTeams.length > 0) {
    await autoUpsert('teams', initialTeams);
    const tournMatches = appData.matches.filter((m) => m.tournament_id === tournament.id);
    await autoUpsert('matches', tournMatches);
  }
}

export async function updateTournament(tournament: Tournament, currentUser: { name: string; role: string }) {
  const idx = appData.tournaments.findIndex((t) => t.id === tournament.id);
  if (idx !== -1) {
    appData.tournaments[idx] = tournament;
    logAudit(currentUser.name, currentUser.role, 'UPDATE_TOURNAMENT', `Mengubah informasi turnamen: "${tournament.name}"`);
    await autoUpsert('tournaments', [tournament]);
  }
}

export async function deleteTournament(tournamentId: string, currentUser: { name: string; role: string }) {
  const target = appData.tournaments.find((t) => t.id === tournamentId);
  appData.tournaments = appData.tournaments.filter((t) => t.id !== tournamentId);
  appData.teams = appData.teams.filter((t) => t.tournament_id !== tournamentId);
  appData.matches = appData.matches.filter((m) => m.tournament_id !== tournamentId);

  if (appData.activeTournamentId === tournamentId) {
    appData.activeTournamentId = appData.tournaments[0]?.id || '';
  }

  logAudit(currentUser.name, currentUser.role, 'DELETE_TOURNAMENT', `Menghapus turnamen: "${target?.name || tournamentId}"`);

  await autoDelete('teams', 'tournament_id', tournamentId);
  await autoDelete('matches', 'tournament_id', tournamentId);
  await autoDelete('tournaments', 'id', tournamentId);
}

export async function saveTeamsAndRegenerateMatches(
  tournamentId: string,
  newTeams: Team[],
  shuffle: boolean,
  includeThirdPlace: boolean,
  currentUser: { name: string; role: string },
  startDate?: string,
  endDate?: string
) {
  const tournament = appData.tournaments.find((t) => t.id === tournamentId);
  if (tournament) {
    if (startDate) tournament.start_date = startDate;
    if (endDate) tournament.end_date = endDate;
    tournament.third_place_match = includeThirdPlace;
    await autoUpsert('tournaments', [tournament]);
  }

  const start = startDate || tournament?.start_date || '2026-08-10';
  const end = endDate || tournament?.end_date || '2026-08-16';

  // Remove existing teams & matches for this tournament
  appData.teams = appData.teams.filter((t) => t.tournament_id !== tournamentId);
  appData.matches = appData.matches.filter((m) => m.tournament_id !== tournamentId);

  appData.teams.push(...newTeams);

  const newMatches = generateKnockoutMatches(
    tournamentId,
    newTeams,
    includeThirdPlace,
    shuffle,
    appData.timeSlots,
    start,
    end
  );
  appData.matches.push(...newMatches);

  logAudit(
    currentUser.name,
    currentUser.role,
    'REGENERATE_BRACKET',
    `Membuat ulang bagan (${newTeams.length} tim) ${shuffle ? '[PENGONCOKAN ACAK]' : '[SESUAI SEEDING]'}`
  );

  // Sync to DB
  await autoDelete('teams', 'tournament_id', tournamentId);
  await autoDelete('matches', 'tournament_id', tournamentId);

  await autoUpsert('teams', newTeams);
  await autoUpsert('matches', newMatches);
}

export async function updateMatches(
  tournamentId: string,
  updatedMatchesList: Match[],
  currentUser: { name: string; role: string },
  actionDetail: string
) {
  // Replace matches for tournament
  const otherMatches = appData.matches.filter((m) => m.tournament_id !== tournamentId);
  appData.matches = [...otherMatches, ...updatedMatchesList];

  logAudit(currentUser.name, currentUser.role, 'UPDATE_MATCHES', actionDetail);

  await autoUpsert('matches', updatedMatchesList);
}

export async function addPanitiaMember(member: PanitiaMember, currentUser: { name: string; role: string }) {
  appData.panitiaMembers.push(member);
  logAudit(currentUser.name, currentUser.role, 'ADD_PANITIA', `Menambah panitia baru: ${member.name} (@${member.username}) - Peran: ${member.role}`);
  await autoUpsert('panitia_members', [member]);

  // Attempt Supabase Auth account creation
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const email = `${member.username.toLowerCase()}@turnamenkd.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password: member.password || '123',
        options: {
          data: {
            name: member.name,
            role: member.role,
            username: member.username,
          },
        },
      });
      if (error && !error.message.includes('User already registered')) {
        console.warn('[SUPABASE AUTH SIGNUP WARNING]', error.message);
      }
    } catch (err) {
      console.warn('[SUPABASE AUTH SIGNUP EXCEPTION]', err);
    }
  }
}

export async function updatePanitiaMember(member: PanitiaMember, currentUser: { name: string; role: string }) {
  const idx = appData.panitiaMembers.findIndex((p) => p.id === member.id);
  if (idx !== -1) {
    appData.panitiaMembers[idx] = member;
    logAudit(currentUser.name, currentUser.role, 'UPDATE_PANITIA', `Memperbarui data panitia: ${member.name}`);
    await autoUpsert('panitia_members', [member]);
  }
}

export async function deletePanitiaMember(id: string, currentUser: { name: string; role: string }) {
  const target = appData.panitiaMembers.find((p) => p.id === id);
  appData.panitiaMembers = appData.panitiaMembers.filter((p) => p.id !== id);
  logAudit(currentUser.name, currentUser.role, 'DELETE_PANITIA', `Menghapus panitia: ${target?.name || id}`);
  await autoDelete('panitia_members', 'id', id);
}

// -------------------------------------------------------------
// TIME SLOT MUTATORS
// -------------------------------------------------------------
export function getTimeSlots(): TimeSlot[] {
  return appData.timeSlots && appData.timeSlots.length > 0 ? appData.timeSlots : DEFAULT_TIME_SLOTS;
}

export async function addTimeSlot(slotLabel: string, currentUser: { name: string; role: string }) {
  const trimmed = slotLabel.trim();
  if (!trimmed) return;

  // Check if exists
  const existing = appData.timeSlots.find((s) => s.slot_label.toLowerCase() === trimmed.toLowerCase());
  if (existing) return;

  const newSlot: TimeSlot = {
    id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    slot_label: trimmed,
    is_default: false,
    created_at: new Date().toISOString(),
  };

  appData.timeSlots.push(newSlot);
  logAudit(currentUser.name, currentUser.role, 'ADD_TIME_SLOT', `Menambahkan slot jam main baru: "${trimmed}"`);

  await autoUpsert('time_slots', [newSlot]);
}

export async function deleteTimeSlot(id: string, currentUser: { name: string; role: string }) {
  const target = appData.timeSlots.find((s) => s.id === id);
  if (!target) return;

  appData.timeSlots = appData.timeSlots.filter((s) => s.id !== id);
  logAudit(currentUser.name, currentUser.role, 'DELETE_TIME_SLOT', `Menghapus slot jam main: "${target.slot_label}"`);

  await autoDelete('time_slots', 'id', id);
}

export function logAudit(userName: string, userRole: string, action: string, details: string) {
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    user_name: userName,
    user_role: userRole,
    action,
    details,
  };
  appData.auditLogs.unshift(log);
  if (appData.auditLogs.length > 100) appData.auditLogs.pop();

  autoUpsert('audit_logs', [log]);
}

export async function resetTournamentData(currentUser: { name: string; role: string }) {
  localStorage.removeItem(STORAGE_KEY);
  appData = {
    tournaments: [DEFAULT_TOURNAMENT],
    teams: DEFAULT_TEAMS,
    matches: generateKnockoutMatches(DEFAULT_TOURNAMENT.id, DEFAULT_TEAMS, true, false),
    panitiaMembers: DEFAULT_MEMBERS,
    timeSlots: DEFAULT_TIME_SLOTS,
    auditLogs: [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        user_name: currentUser.name,
        user_role: currentUser.role,
        action: 'RESET_SYSTEM',
        details: 'Data turnamen di-reset ke pengaturan awal pabrik.',
      },
    ],
    activeTournamentId: DEFAULT_TOURNAMENT.id,
  };

  saveToLocalStorage();
  notifyListeners();
}
