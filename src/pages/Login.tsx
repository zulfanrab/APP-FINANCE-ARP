// ============================================================
// ARKA Finance — Login Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { AlertCircle, Crown, Calculator, BookOpen } from 'lucide-react';
import logo from '../assets/logo.png';
import { verifyPin } from '../services/authService';
import { type UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';
import { UserGuideModal } from '../components/ui/UserGuideModal';

export function Login() {
  const { login } = useAuth();
  const { addToast } = useApp();
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const handleVerify = async (pinValue: string) => {
    if (pinValue.length !== 6) {
      setError('PIN harus 6 digit');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const valid = await verifyPin(pinValue);
      if (valid) {
        setPinVerified(true);
      } else {
        setError('PIN salah. Coba lagi.');
        setPin('');
      }
    } catch {
      setError('Gagal memverifikasi PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if (newPin.length === 6) {
        handleVerify(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pinVerified) {
        if (e.key >= '0' && e.key <= '9') {
          handleNumberClick(e.key);
        } else if (e.key === 'Backspace') {
          handleDelete();
        } else if (e.key === 'Escape') {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, pinVerified]);

  const handleSelectRole = (role: UserRole) => {
    login(role);
    addToast('success', `Masuk sebagai ${role === 'owner' ? 'Owner' : 'Admin Keuangan'}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#299775]/20 border border-[#299775]/30 p-2 mx-auto mb-3 flex items-center justify-center shadow-inner">
            <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ARKA Finance</h1>
          <p className="text-emerald-400 text-xs font-semibold">PT Aksara Riksa Perdana</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
          {!pinVerified ? (
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Masuk ke ARKA</h2>
              <p className="text-xs text-gray-500 mb-6 text-center">Masukkan 6-Digit PIN Keamanan Perusahaan</p>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 mb-6">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200
                      ${i < pin.length
                        ? 'bg-[#299775] border-[#299775] scale-125 shadow-[0_0_8px_rgba(41,151,117,0.5)]'
                        : 'bg-transparent border-gray-300'}`}
                  />
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 mb-6 text-red-600 text-xs bg-red-50 py-2 px-4 rounded-xl w-full justify-center font-semibold">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Calculator Numpad Grid */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumberClick(num.toString())}
                    className="aspect-square rounded-2xl flex items-center justify-center text-xl font-bold text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all duration-100 active:scale-95 shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="aspect-square rounded-2xl flex items-center justify-center text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all active:scale-95"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleNumberClick('0')}
                  className="aspect-square rounded-2xl flex items-center justify-center text-xl font-bold text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all active:scale-95 shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="aspect-square rounded-2xl flex items-center justify-center text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-100 transition-all active:scale-95"
                >
                  DEL
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Pilih Peran Masuk</h2>
              <p className="text-xs text-gray-500 mb-6 text-center">Pilih akun peran Anda di PT ARP</p>

              <div className="space-y-3">
                <button
                  onClick={() => handleSelectRole('owner')}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold text-xl flex-shrink-0">
                    👑
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Direksi / Pimpinan</p>
                    <p className="text-xs text-gray-500 mt-0.5">Kontrol ringkasan, approval &amp; prive</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectRole('admin')}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold text-xl flex-shrink-0">
                    💼
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Admin Keuangan</p>
                    <p className="text-xs text-gray-500 mt-0.5">Input transaksi, proyek &amp; laporan</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => { setPinVerified(false); setPin(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors font-semibold"
              >
                ← Kembali Masukkan PIN
              </button>
            </>
          )}
        </div>

        {/* User Manual Guide Button */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-300 text-xs font-bold rounded-2xl transition-all active:scale-95 shadow-md"
          >
            <BookOpen size={16} /> 📖 Panduan Penggunaan ARKA Finance
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs">
          © 2026 PT Aksara Riksa Perdana. All rights reserved.
        </p>

        <UserGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      </div>
    </div>
  );
}
