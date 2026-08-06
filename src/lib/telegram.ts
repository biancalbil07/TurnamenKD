import { TelegramSettings, Match, Tournament } from '../types';
import { getSupabaseClient } from './supabase';

/**
 * Extracts numeric message_thread_id (Topic ID) from string input or Telegram link.
 * Example inputs:
 * - "123" -> 123
 * - "https://t.me/c/1234567890/123" -> 123
 * - "https://t.me/groupname/999" -> 999
 */
export function parseTelegramTopicId(input?: string): number | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Check if input is a Telegram URL or contains slashes
  if (trimmed.includes('/') || trimmed.includes('t.me')) {
    const clean = trimmed.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      return parseInt(lastPart, 10);
    }
  }

  // If input is a direct integer string
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  return undefined;
}

export function getTelegramSettings(): TelegramSettings {
  const saved = localStorage.getItem('turnamen_kd_telegram_settings_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
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

  return {
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
}

export function saveTelegramSettings(settings: TelegramSettings) {
  localStorage.setItem('turnamen_kd_telegram_settings_v2', JSON.stringify(settings));

  // Async sync to Supabase if client is active
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase
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
      })
      .then(({ error }) => {
        if (error) console.warn('Supabase telegram_settings upsert error:', error);
      });
  }
}

/**
 * Sync telegram settings from Supabase if available
 */
export async function syncTelegramSettingsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { data } = await supabase.from('telegram_settings').select('*').eq('id', 'default').single();
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
      localStorage.setItem('turnamen_kd_telegram_settings_v2', JSON.stringify(settings));
    }
  } catch {
    // ignore
  }
}

/**
  Send Text Notification via Bot 1 (Hasil Pertandingan)
 */
export async function sendTelegramBot1Message(text: string): Promise<{ success: boolean; message: string }> {
  const settings = getTelegramSettings();
  if (!settings.bot1_enabled || !settings.bot1_token || !settings.bot1_chat_id) {
    return { success: false, message: 'Bot 1 Telegram belum diaktifkan atau data Token/Chat ID belum lengkap.' };
  }

  try {
    const url = `https://api.telegram.org/bot${settings.bot1_token}/sendMessage`;
    const payload: Record<string, any> = {
      chat_id: settings.bot1_chat_id,
      text: text,
      parse_mode: 'Markdown',
    };

    const threadId = parseTelegramTopicId(settings.bot1_topic_id);
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
          ? `Notifikasi Bot 1 berhasil dikirim ke Topic Chat (#${threadId})!`
          : 'Notifikasi Bot 1 (Hasil Pertandingan) berhasil dikirim!',
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
  if (!settings.bot2_enabled || !settings.bot2_token || !settings.bot2_chat_id) {
    return { success: false, message: 'Bot 2 Telegram (Update Bagan) belum diaktifkan atau data Token/Chat ID belum lengkap.' };
  }

  try {
    const url = `https://api.telegram.org/bot${settings.bot2_token}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', settings.bot2_chat_id);
    formData.append('photo', imageBlob, 'bagan_turnamen.png');
    formData.append('caption', caption);

    const threadId = parseTelegramTopicId(settings.bot2_topic_id);
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
          ? `Gambar bagan berhasil dikirim ke Topic Chat Bot 2 (#${threadId})!`
          : 'Gambar bagan terbaru berhasil dikirim ke Telegram Bot 2!',
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
