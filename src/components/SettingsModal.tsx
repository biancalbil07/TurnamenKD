import React, { useState } from 'react';
import { X, Database, Send, Code, Save, RefreshCw, CheckCircle, AlertCircle, Copy, Check, ShieldAlert, Image } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { getTelegramSettings, saveTelegramSettings, sendTelegramBot1Message, sendTelegramBot2Photo, parseTelegramChatId, parseTelegramTopicId } from '../lib/telegram';
import { resetTournamentData, initDatabase } from '../lib/db';
import { Role } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  currentUser: { name: string; role: Role };
  onRefreshData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  currentUser,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'supabase' | 'telegram' | 'schema' | 'reset'>('supabase');

  // Supabase state
  const currentSupa = getSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(currentSupa.url);
  const [supaKey, setSupaKey] = useState(currentSupa.anonKey);
  const [supaEnabled, setSupaEnabled] = useState(currentSupa.enabled);
  const [supaTestMsg, setSupaTestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingSupa, setIsTestingSupa] = useState(false);

  // Telegram state (2 Bots)
  const currentTele = getTelegramSettings();
  
  // Bot 1
  const [bot1Token, setBot1Token] = useState(currentTele.bot1_token);
  const [bot1ChatId, setBot1ChatId] = useState(currentTele.bot1_chat_id);
  const [bot1TopicId, setBot1TopicId] = useState(currentTele.bot1_topic_id || '');
  const [bot1Enabled, setBot1Enabled] = useState(currentTele.bot1_enabled);
  const [teleScoreNotif, setTeleScoreNotif] = useState(currentTele.auto_notify_score);
  const [teleSchedNotif, setTeleSchedNotif] = useState(currentTele.auto_notify_schedule);
  const [bot1TestMsg, setBot1TestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingBot1, setIsTestingBot1] = useState(false);

  // Bot 2
  const [bot2Token, setBot2Token] = useState(currentTele.bot2_token);
  const [bot2ChatId, setBot2ChatId] = useState(currentTele.bot2_chat_id);
  const [bot2TopicId, setBot2TopicId] = useState(currentTele.bot2_topic_id || '');
  const [bot2Enabled, setBot2Enabled] = useState(currentTele.bot2_enabled);
  const [bot2TestMsg, setBot2TestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingBot2, setIsTestingBot2] = useState(false);

  // Parsed Telegram values live
  const parsedBot1Chat = parseTelegramChatId(bot1ChatId, bot1TopicId);
  const parsedBot1Topic = parseTelegramTopicId(bot1TopicId, bot1ChatId);
  const parsedBot2Chat = parseTelegramChatId(bot2ChatId, bot2TopicId);
  const parsedBot2Topic = parseTelegramTopicId(bot2TopicId, bot2ChatId);

  // SQL Copy state
  const [copiedSQL, setCopiedSQL] = useState(false);

  const handleSaveSupabase = async () => {
    saveSupabaseConfig({
      url: supaUrl.trim(),
      anonKey: supaKey.trim(),
      enabled: supaEnabled,
    });
    alert('Pengaturan Database Supabase berhasil disimpan! Memulai sinkronisasi data...');
    await initDatabase();
    onRefreshData();
  };

  const handleTestSupabase = async () => {
    setIsTestingSupa(true);
    setSupaTestMsg(null);
    const res = await testSupabaseConnection(supaUrl.trim(), supaKey.trim());
    setSupaTestMsg(res);
    setIsTestingSupa(false);
  };

  const handleSaveTelegram = async () => {
    await saveTelegramSettings({
      bot1_token: bot1Token.trim(),
      bot1_chat_id: bot1ChatId.trim(),
      bot1_topic_id: bot1TopicId.trim(),
      bot1_enabled: bot1Enabled,
      auto_notify_score: teleScoreNotif,
      auto_notify_schedule: teleSchedNotif,

      bot2_token: bot2Token.trim(),
      bot2_chat_id: bot2ChatId.trim(),
      bot2_topic_id: bot2TopicId.trim(),
      bot2_enabled: bot2Enabled,
    });
    alert('Pengaturan 2 Bot Telegram berhasil disimpan secara permanen di Database Supabase & Local Cache!');
  };

  const handleTestBot1 = async () => {
    setIsTestingBot1(true);
    setBot1TestMsg(null);
    saveTelegramSettings({
      bot1_token: bot1Token.trim(),
      bot1_chat_id: bot1ChatId.trim(),
      bot1_topic_id: bot1TopicId.trim(),
      bot1_enabled: true,
      auto_notify_score: teleScoreNotif,
      auto_notify_schedule: teleSchedNotif,

      bot2_token: bot2Token.trim(),
      bot2_chat_id: bot2ChatId.trim(),
      bot2_topic_id: bot2TopicId.trim(),
      bot2_enabled: bot2Enabled,
    });
    const res = await sendTelegramBot1Message('🤖 *TEST BOT 1 (HASIL PERTANDINGAN)*\nSistem Turnamen KD berhasil terhubung dengan Bot 1!');
    setBot1TestMsg(res);
    setIsTestingBot1(false);
  };

  const handleTestBot2 = async () => {
    setIsTestingBot2(true);
    setBot2TestMsg(null);
    saveTelegramSettings({
      bot1_token: bot1Token.trim(),
      bot1_chat_id: bot1ChatId.trim(),
      bot1_topic_id: bot1TopicId.trim(),
      bot1_enabled: bot1Enabled,
      auto_notify_score: teleScoreNotif,
      auto_notify_schedule: teleSchedNotif,

      bot2_token: bot2Token.trim(),
      bot2_chat_id: bot2ChatId.trim(),
      bot2_topic_id: bot2TopicId.trim(),
      bot2_enabled: true,
    });

    // Create a 1x1 test red pixel canvas image blob
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText('TEST BOT 2', 10, 50);
    }
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const res = await sendTelegramBot2Photo(blob, '📸 *TEST BOT 2 (UPDATE GAMBAR BAGAN)*\nBot 2 berhasil menerima pengiriman gambar!');
        setBot2TestMsg(res);
      } else {
        setBot2TestMsg({ success: false, message: 'Gagal membuat gambar test.' });
      }
      setIsTestingBot2(false);
    });
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const handleResetSystem = async () => {
    if (currentUser.role !== 'master') {
      alert('Hanya Master Admin yang dapat mereset database sistem.');
      return;
    }

    if (confirm('PERINGATAN! Seluruh data turnamen, tim, dan skor akan di-reset ke data awal. Lanjutkan?')) {
      await resetTournamentData(currentUser);
      alert('Sistem berhasil di-reset!');
      onRefreshData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-800 to-red-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-black flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-300" /> Pengaturan Sistem & Database
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'supabase' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-600" /> Database Supabase
          </button>
          
          <button
            onClick={() => setActiveTab('telegram')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'telegram' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" /> 2 Bot Telegram (Hasil & Bagan)
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'schema' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-4 h-4 text-purple-600" /> SQL Schema Exporter
          </button>

          <button
            onClick={() => setActiveTab('reset')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'reset' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-600" /> Reset Database
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: SUPABASE */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 leading-relaxed">
                <strong>💡 Supabase Database Sync:</strong> Hubungkan ke Supabase PostgreSQL Anda untuk sinkronisasi real-time instan antar browser dan multi-panitia. Jika dibiarkan kosong, aplikasi tetap berjalan 100% menggunakan <strong>Local Realtime Engine</strong>!
              </div>

              <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supaEnabled}
                  onChange={(e) => setSupaEnabled(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                Aktifkan Integrasi Supabase Cloud
              </label>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supabase Project URL</label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supabase Anon Key</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supaKey}
                  onChange={(e) => setSupaKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
                />
              </div>

              {supaTestMsg && (
                <div className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${
                  supaTestMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
                }`}>
                  {supaTestMsg.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {supaTestMsg.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSupa}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  {isTestingSupa ? 'Menguji...' : 'Uji Koneksi'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSupabase}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TELEGRAM 2 BOTS */}
          {activeTab === 'telegram' && (
            <div className="space-y-6">
              
              {/* BOT 1 CONFIGURATION */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <div className="font-extrabold text-blue-950 flex items-center gap-2 text-sm">
                    <Send className="w-4 h-4 text-blue-600" />
                    BOT 1: Pelaporan Hasil Pertandingan & Skor (Teks)
                  </div>
                  <label className="flex items-center gap-1.5 font-bold text-blue-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bot1Enabled}
                      onChange={(e) => setBot1Enabled(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Aktifkan Bot 1
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bot 1 Token</label>
                    <input
                      type="text"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={bot1Token}
                      onChange={(e) => setBot1Token(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bot 1 Chat ID / Link Chat</label>
                    <input
                      type="text"
                      placeholder="-1001234567890 atau https://t.me/acara17kd"
                      value={bot1ChatId}
                      onChange={(e) => setBot1ChatId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                    />
                    {parsedBot1Chat && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                        ✓ Target Chat: <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">{parsedBot1Chat}</code>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bot 1 Topic ID / Link Topic Chat <span className="text-[10px] text-slate-400 font-normal">(Opsional - Forum Supergroup)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="123 atau https://t.me/acara17kd/4"
                    value={bot1TopicId}
                    onChange={(e) => setBot1TopicId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                  />
                  {parsedBot1Topic !== undefined && (
                    <p className="text-[11px] font-semibold text-blue-800 mt-1 flex items-center gap-1">
                      ✓ Topic Thread: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-bold">#{parsedBot1Topic}</code>
                    </p>
                  )}
                  <p className="text-[10px] text-blue-900 mt-1 italic font-medium">
                    * Masukkan Topic ID (misal: 4) atau tempelkan (paste) langsung Link Topic Chat Telegram Anda (misal: https://t.me/acara17kd/4).
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] pt-1">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teleScoreNotif}
                      onChange={(e) => setTeleScoreNotif(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    Kirim Otomatis Saat Input Skor
                  </label>

                  <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teleSchedNotif}
                      onChange={(e) => setTeleSchedNotif(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    Kirim Otomatis Perubahan Jadwal
                  </label>
                </div>

                {bot1TestMsg && (
                  <div className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 ${
                    bot1TestMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
                  }`}>
                    {bot1TestMsg.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {bot1TestMsg.message}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleTestBot1}
                    disabled={isTestingBot1}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow transition"
                  >
                    {isTestingBot1 ? 'Mengirim...' : 'Uji Bot 1'}
                  </button>
                </div>
              </div>

              {/* BOT 2 CONFIGURATION */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <div className="font-extrabold text-purple-950 flex items-center gap-2 text-sm">
                    <Image className="w-4 h-4 text-purple-600" />
                    BOT 2: Upload Gambar Bagan Pertandigan (PNG)
                  </div>
                  <label className="flex items-center gap-1.5 font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bot2Enabled}
                      onChange={(e) => setBot2Enabled(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    Aktifkan Bot 2
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bot 2 Token</label>
                    <input
                      type="text"
                      placeholder="987654321:XYZabcDefGhIJKlmNoPQRsTUVwx"
                      value={bot2Token}
                      onChange={(e) => setBot2Token(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bot 2 Chat ID / Link Chat</label>
                    <input
                      type="text"
                      placeholder="-1009876543210 atau https://t.me/acara17kd"
                      value={bot2ChatId}
                      onChange={(e) => setBot2ChatId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                    />
                    {parsedBot2Chat && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                        ✓ Target Chat: <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">{parsedBot2Chat}</code>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bot 2 Topic ID / Link Topic Chat <span className="text-[10px] text-slate-400 font-normal">(Opsional - Forum Supergroup)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="123 atau https://t.me/acara17kd/8"
                    value={bot2TopicId}
                    onChange={(e) => setBot2TopicId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-800"
                  />
                  {parsedBot2Topic !== undefined && (
                    <p className="text-[11px] font-semibold text-purple-800 mt-1 flex items-center gap-1">
                      ✓ Topic Thread: <code className="bg-purple-100 px-1.5 py-0.5 rounded text-purple-900 font-bold">#{parsedBot2Topic}</code>
                    </p>
                  )}
                  <p className="text-[10px] text-purple-900 mt-1 italic font-medium">
                    * Masukkan Topic ID (misal: 8) atau tempelkan (paste) langsung Link Topic Chat Telegram Anda (misal: https://t.me/acara17kd/8).
                  </p>
                </div>

                {bot2TestMsg && (
                  <div className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 ${
                    bot2TestMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
                  }`}>
                    {bot2TestMsg.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {bot2TestMsg.message}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleTestBot2}
                    disabled={isTestingBot2}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow transition"
                  >
                    {isTestingBot2 ? 'Mengirim Gambar Test...' : 'Uji Kirim Gambar Bot 2'}
                  </button>
                </div>
              </div>

              {/* SAVE BUTTON FOR ALL TELEGRAM BOTS */}
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleSaveTelegram}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-lg shadow-red-600/20 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan Konfigurasi 2 Bot Telegram
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: SQL SCHEMA */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  Copy kueri SQL di bawah lalu jalankan di <strong>Supabase SQL Editor</strong> untuk membuat tabel database & kebijakan realtime secara otomatis.
                </p>

                <button
                  onClick={handleCopySQL}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  {copiedSQL ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSQL ? 'Tersalin!' : 'Copy SQL Schema'}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[300px] border border-slate-800 leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          )}

          {/* TAB 4: RESET SYSTEM */}
          {activeTab === 'reset' && (
            <div className="space-y-4 bg-red-50 border border-red-200 p-5 rounded-2xl">
              <h4 className="font-extrabold text-red-800 text-sm flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" /> Reset Database Turnamen KD
              </h4>
              <p className="text-red-700">
                Tindakan ini akan mengosongkan seluruh data turnamen lokal, daftar tim, skor pertandingan, dan audit log, lalu mengembalikan sistem ke data awal pabrik.
              </p>

              <button
                type="button"
                onClick={handleResetSystem}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-extrabold shadow-md transition"
              >
                Reset Semua Data Turnamen
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

