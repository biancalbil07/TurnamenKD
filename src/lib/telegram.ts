import { TelegramSettings, Match, Tournament } from '../types';
import { getSupabaseClient } from './supabase';

/**
 * Extracts Telegram chatId and message_thread_id (Topic ID) from URLs or strings.
 * Supports:
 * - Public groups: https://t.me/acara17kd or https://t.me/acara17kd/4 -> chatId: "@acara17kd", topicId: 4
 * - Private groups: https://t.me/c/1234567890/4 -> chatId: "-1001234567890", topicId: 4
 * - Direct IDs/Usernames: "@acara17kd", "-1001234567890", "123"
 */
function extractTelegramLinkInfo(urlStr: string): { chatId?: string; topicId?: number } {
  if (!urlStr) return {};
  const trimmed = urlStr.trim();
  if (!trimmed) return {};

  try {
    let clean = trimmed.split('?')[0].split('#')[0];
    clean = clean.replace(/^https?:\/\//i, '').replace(/^(t|telegram)\.me\//i, '');
    clean = clean.replace(/^\/+|\/+$/g, '');

    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 0) return {};

    if (parts[0] === 'c' && parts.length >= 2) {
      const rawId = parts[1];
      const chatId = rawId.startsWith('-100') ? rawId : `-100${rawId}`;
      let topicId: number | undefined = undefined;
      if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
        topicId = parseInt(parts[2], 10);
      }
      return { chatId, topicId };
    } else {
      if (!parts[0].startsWith('@') && /^\d+$/.test(parts[0])) {
        return { chatId: parts[0] };
      }
      const username = parts[0].startsWith('@') ? parts[0] : `@${parts[0]}`;
      let topicId: number | undefined = undefined;
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        topicId = parseInt(parts[1], 10);
      }
      return { chatId: username, topicId };
    }
  } catch {
    return {};
  }
}

export function parseTelegramChatId(chatInput?: string, topicInput?: string): string {
  const c = (chatInput || '').trim();
  const t = (topicInput || '').trim();

  if (c.includes('t.me') || c.startsWith('http://') || c.startsWith('https://')) {
    const info = extractTelegramLinkInfo(c);
    if (info.chatId) return info.chatId;
  }

  if (c) {
    if (c.startsWith('@') || c.startsWith('-') || /^\d+$/.test(c)) {
      return c;
    }
    if (/^[a-zA-Z0-9_]{5,}$/.test(c)) {
      return `@${c}`;
    }
    return c;
  }

  if (t.includes('t.me') || t.startsWith('http://') || t.startsWith('https://')) {
    const info = extractTelegramLinkInfo(t);
    if (info.chatId) return info.chatId;
  }

  return '';
}

export function parseTelegramTopicId(topicInput?: string, chatInput?: string): number | undefined {
  const t = (topicInput || '').trim();
  const c = (chatInput || '').trim();

  if (t) {
    if (t.includes('t.me') || t.startsWith('http://') || t.startsWith('https://')) {
      const info = extractTelegramLinkInfo(t);
      if (info.topicId !== undefined) return info.topicId;
    }
    if (/^\d+$/.test(t)) {
      return parseInt(t, 10);
    }
  }

  if (c.includes('t.me') || c.startsWith('http://') || c.startsWith('https://')) {
    const info = extractTelegramLinkInfo(c);
    if (info.topicId !== undefined) return info.topicId;
  }

  return undefined;
}

let memorySettingsCache: TelegramSettings | null = null;

export function getTelegramSettings(): TelegramSettings {
  if (memorySettingsCache) {
    return memorySettingsCache;
  }

  const saved = localStorage.getItem('turnamen_kd_telegram_settings_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      memorySettingsCache = {
        bot1_token: parsed.bot1_token || '',
        bot1_chat_id: parsed.bot1_chat_id || '',
        bot1_topic_id: parsed.bot1_topic_id || '',
        bot1_enabled: !!parsed.bot1_enabled,
        auto_notify_score: parsed.auto_notify_score ?? true,
        auto_notify_schedule: parsed.auto_notify_schedule ?? true,

        bot2_token: parsed.bot2_token || '',
        bot2_chat_id: parsed.bot2_chat_id || '',
        bot2_topic_id: parsed.bot2_topic_id || '',
        bot2_enabled: !!parsed.bot2_enabled,
      };
      return memorySettingsCache;
    } catch {
      // ignore
    }
  }

  // Fallback for migration from v1
  const oldSaved = localStorage.getItem('turnamen_kd_telegram_settings');
  let oldToken = '';
  let oldChatId = '';
  let oldEnabled = false;
  if (oldSaved) {
    try {
      const oldP = JSON.parse(oldSaved);
      oldToken = oldP.bot_token || '';
      oldChatId = oldP.chat_id || '';
      oldEnabled = !!oldP.enabled;
    } catch {
      // ignore
    }
  }

  memorySettingsCache = {
    bot1_token: oldToken,
    bot1_chat_id: oldChatId,
    bot1_topic_id: '',
    bot1_enabled: oldEnabled,
    auto_notify_score: true,
    auto_notify_schedule: true,

    bot2_token: '',
    bot2_chat_id: '',
    bot2_topic_id: '',
    bot2_enabled: false,
  };
  return memorySettingsCache;
}

export async function saveTelegramSettings(settings: TelegramSettings) {
  memorySettingsCache = { ...settings };
  localStorage.setItem('turnamen_kd_telegram_settings_v2', JSON.stringify(settings));

  // Async sync to Supabase if client is active
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('telegram_settings')
        .upsert({
          id: 'default',
          bot1_token: settings.bot1_token,
          bot1_chat_id: settings.bot1_chat_id,
          bot1_topic_id: settings.bot1_topic_id || '',
          bot1_enabled: settings.bot1_enabled,
          auto_notify_score: settings.auto_notify_score,
          auto_notify_schedule: settings.auto_notify_schedule,
          bot2_token: settings.bot2_token,
          bot2_chat_id: settings.bot2_chat_id,
          bot2_topic_id: settings.bot2_topic_id || '',
          bot2_enabled: settings.bot2_enabled,
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.error('[SUPABASE TELEGRAM SETTINGS ERROR]', error.message, error);
      } else {
        console.log('[SUPABASE TELEGRAM SETTINGS SUCCESS] Saved permanently to Supabase.');
      }
    } catch (err) {
      console.error('[SUPABASE TELEGRAM SETTINGS EXCEPTION]', err);
    }
  }
}

/**
 * Sync telegram settings from Supabase if available
 */
export async function syncTelegramSettingsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('telegram_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.warn('[SUPABASE TELEGRAM FETCH WARNING]', error.message);
      return;
    }

    if (data) {
      const settings: TelegramSettings = {
        bot1_token: data.bot1_token || '',
        bot1_chat_id: data.bot1_chat_id || '',
        bot1_topic_id: data.bot1_topic_id || '',
        bot1_enabled: !!data.bot1_enabled,
        auto_notify_score: data.auto_notify_score ?? true,
        auto_notify_schedule: data.auto_notify_schedule ?? true,

        bot2_token: data.bot2_token || '',
        bot2_chat_id: data.bot2_chat_id || '',
        bot2_topic_id: data.bot2_topic_id || '',
        bot2_enabled: !!data.bot2_enabled,
      };
      memorySettingsCache = settings;
      localStorage.setItem('turnamen_kd_telegram_settings_v2', JSON.stringify(settings));
    }
  } catch (err) {
    console.warn('[SUPABASE TELEGRAM FETCH EXCEPTION]', err);
  }
}

/**
  Send Text Notification via Bot 1 (Hasil Pertandingan)
 */
export async function sendTelegramBot1Message(text: string): Promise<{ success: boolean; message: string }> {
  const settings = getTelegramSettings();
  if (!settings.bot1_enabled || !settings.bot1_token || (!settings.bot1_chat_id && !settings.bot1_topic_id)) {
    return { success: false, message: 'Bot 1 Telegram belum diaktifkan atau data Token/Chat ID belum lengkap.' };
  }

  try {
    const targetChatId = parseTelegramChatId(settings.bot1_chat_id, settings.bot1_topic_id);
    const threadId = parseTelegramTopicId(settings.bot1_topic_id, settings.bot1_chat_id);

    if (!targetChatId) {
      return { success: false, message: 'Bot 1 Chat ID tidak valid. Masukkan username (misal @nama_grup), ID (-100xxx), atau Link Topic Telegram.' };
    }

    const url = `https://api.telegram.org/bot${settings.bot1_token}/sendMessage`;
    const payload: Record<string, any> = {
      chat_id: targetChatId,
      text: text,
      parse_mode: 'Markdown',
    };

    if (threadId !== undefined) {
      payload.message_thread_id = threadId;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) {
      return {
        success: true,
        message: threadId !== undefined
          ? `Notifikasi Bot 1 berhasil dikirim ke Topic Chat (${targetChatId} #${threadId})!`
          : `Notifikasi Bot 1 berhasil dikirim ke (${targetChatId})!`,
      };
    } else {
      return { success: false, message: `Bot 1 Gagal: ${data.description || 'Unknown error'}` };
    }
  } catch (err: any) {
    console.error('Bot 1 notification error:', err);
    return { success: false, message: `Error koneksi Bot 1: ${err.message || err}` };
  }
}

/**
  Send Bracket PNG Image via Bot 2 (Update Bagan)
 */
export async function sendTelegramBot2Photo(imageBlob: Blob, caption: string): Promise<{ success: boolean; message: string }> {
  const settings = getTelegramSettings();
  if (!settings.bot2_enabled || !settings.bot2_token || (!settings.bot2_chat_id && !settings.bot2_topic_id)) {
    return { success: false, message: 'Bot 2 Telegram (Update Bagan) belum diaktifkan atau data Token/Chat ID belum lengkap.' };
  }

  try {
    const targetChatId = parseTelegramChatId(settings.bot2_chat_id, settings.bot2_topic_id);
    const threadId = parseTelegramTopicId(settings.bot2_topic_id, settings.bot2_chat_id);

    if (!targetChatId) {
      return { success: false, message: 'Bot 2 Chat ID tidak valid. Masukkan username (misal @nama_grup), ID (-100xxx), atau Link Topic Telegram.' };
    }

    const url = `https://api.telegram.org/bot${settings.bot2_token}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', targetChatId);
    formData.append('photo', imageBlob, 'bagan_turnamen.png');
    formData.append('caption', caption);

    if (threadId !== undefined) {
      formData.append('message_thread_id', String(threadId));
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.ok) {
      return {
        success: true,
        message: threadId !== undefined
          ? `Gambar bagan berhasil dikirim ke Topic Chat Bot 2 (${targetChatId} #${threadId})!`
          : `Gambar bagan terbaru berhasil dikirim ke Telegram Bot 2 (${targetChatId})!`,
      };
    } else {
      return { success: false, message: `Bot 2 Gagal kirim gambar: ${data.description || 'Unknown error'}` };
    }
  } catch (err: any) {
    console.error('Bot 2 photo upload error:', err);
    return { success: false, message: `Error koneksi Bot 2: ${err.message || err}` };
  }
}

export async function notifyMatchScore(match: Match, tournament: Tournament, winnerName?: string) {
  const settings = getTelegramSettings();
  if (!settings.bot1_enabled || !settings.auto_notify_score) return;

  const statusText = match.status === 'completed' ? '🏁 *PERTANDINGAN SELESAI*' : '⚽ *UPDATE SKOR LANGSUNG*';
  
  const text = `${statusText}
🏆 *${tournament.name}* (${tournament.category})
📌 *${match.round_name}* (${match.match_code})

🔴 *${match.team1_name}* [ *${match.team1_score ?? 0}* ]
⚡ VS
⚪ *${match.team2_name}* [ *${match.team2_score ?? 0}* ]

🏟️ Lapangan: *${match.venue}*
⏰ Jam: ${match.time || 'TBA'} WIB ${match.time_slot ? `(${match.time_slot})` : ''}
📅 Tanggal: ${match.date || 'TBA'}
${winnerName ? `🎉 Pemenang: *${winnerName}* (Lolos ke babak berikutnya!)` : ''}

_Turnamen KD System Real-Time_`;

  await sendTelegramBot1Message(text);
}

export async function notifyScheduleUpdate(match: Match, tournament: Tournament) {
  const settings = getTelegramSettings();
  if (!settings.bot1_enabled || !settings.auto_notify_schedule) return;

  const text = `📅 *UPDATE JADWAL PERTANDINGAN*
🏆 *${tournament.name}*
📌 *${match.round_name}* (${match.match_code})

⚔️ *${match.team1_name}* vs *${match.team2_name}*
🏟️ Lapangan: *${match.venue}*
📅 Tanggal: *${match.date || 'Belum diatur'}*
⏰ Waktu: *${match.time || 'Belum diatur'}* WIB ${match.time_slot ? `[Slot: ${match.time_slot}]` : ''}

_Mohon tim bersiap 15 menit sebelum pertandingan dimulai._`;

  await sendTelegramBot1Message(text);
}
