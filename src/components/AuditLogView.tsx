import React, { useState } from 'react';
import { AuditLog } from '../types';
import { History, Search, Clock, Shield, Activity, Download } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term)
    );
  });

  const exportLogsJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_logs_turnamen_kd_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-red-600" />
            <span>Catatan Riwayat & Audit System</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Merekam setiap aktivitas panitia (Input skor, perubahan jadwal, generasi bagan, dan manajemen akun).
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari dalam log..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <button
            onClick={exportLogsJSON}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-600" /> Export JSON
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-extrabold text-sm text-slate-800 flex items-center justify-between">
          <span>Riwayat Aktivitas Panitia ({filteredLogs.length})</span>
          <span className="text-xs text-slate-500 font-normal">Sistem Keamanan Log Terisolasi</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada catatan riwayat yang cocok dengan pencarian Anda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const isMaster = log.user_role === 'master';

              return (
                <div key={log.id} className="p-4 sm:px-6 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-extrabold text-slate-800">{log.user_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isMaster ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isMaster ? '👑 Master' : '⚽ Lapangan'}
                      </span>
                      <span className="bg-red-50 text-red-700 border border-red-200 font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-600">{log.details}</p>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
