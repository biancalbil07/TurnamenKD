import React, { useState } from 'react';
import { Tournament, TournamentCategory, Team, Role } from '../types';
import { Trophy, X, Plus, Sparkles } from 'lucide-react';
import { addTournament } from '../lib/db';

interface NewTournamentModalProps {
  onClose: () => void;
  currentUser: { name: string; role: Role };
  onCreated: () => void;
}

export const NewTournamentModal: React.FC<NewTournamentModalProps> = ({
  onClose,
  currentUser,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TournamentCategory>('Futsal');
  const [thirdPlace, setThirdPlace] = useState(true);
  const [teamsText, setTeamsText] = useState('Garuda FC\nPersib Muda\nArema Thunder\nPersebaya Blitz\nPSM Makassar\nBali United\nSriwijaya FC\nPersija Strikers');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tournId = `tourn_${Date.now()}`;
    const newTourn: Tournament = {
      id: tournId,
      name: name.trim(),
      category,
      status: 'active',
      created_at: new Date().toISOString(),
      third_place_match: thirdPlace,
    };

    const teamLines = teamsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const initialTeams: Team[] = teamLines.map((teamName, idx) => ({
      id: `team_${tournId}_${idx}`,
      tournament_id: tournId,
      name: teamName,
      seed: idx + 1,
      logo_emoji: ['⚽', '🏆', '🔥', '⚡', '🦅', '🦁', '🐉', '🐯', '🔵', '🔴', '🟢', '⭐'][idx % 12],
    }));

    await addTournament(newTourn, initialTeams, currentUser);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-300" /> Buat Turnamen Baru
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          <div>
            <label className="block font-extrabold text-slate-800 mb-1">Nama Turnamen</label>
            <input
              type="text"
              placeholder="Misal: KD Futsal Championship 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori Olahraga</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TournamentCategory)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
              >
                <option value="Futsal">Futsal ⚽</option>
                <option value="Badminton">Badminton 🏸</option>
                <option value="Esports">Esports 🎮</option>
                <option value="Mini Soccer">Mini Soccer ⚽</option>
                <option value="Voli">Voli 🏐</option>
                <option value="Basket">Basket 🏀</option>
                <option value="Lainnya">Lainnya 🏆</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-4">
                <input
                  type="checkbox"
                  checked={thirdPlace}
                  onChange={(e) => setThirdPlace(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                Perebutan Juara 3
              </label>
            </div>
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 mb-1 flex items-center justify-between">
              <span>Daftar Tim Awal (Paste / Baris)</span>
              <span className="text-slate-400 font-normal">Otomatis buat bagan</span>
            </label>
            <textarea
              rows={6}
              value={teamsText}
              onChange={(e) => setTeamsText(e.target.value)}
              placeholder="Masukkan 1 nama tim per baris..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Buat Turnamen
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
