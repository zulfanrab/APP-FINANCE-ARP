// ============================================================
// ARKA Finance — Login Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { AlertCircle, Crown, Calculator } from 'lucide-react';
import logo from '../assets/logo.png';
import { verifyPin } from '../services/authService';
import { type UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const { addToast } = useApp();
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumberClick = (digit: string) => {
    setPin(prev => {
      if (prev.length < 6) {
        setError('');
        return prev + digit;
      }
      return prev;
    });
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleConfirm = () => {
    handleVerify(pin);
  };

  useEffect(() => {
    if (pinVerified) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setError('');
      } else if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === 'Enter') {
        if (pin.length === 6 && !loading) {
          handleConfirm();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin, pinVerified, loading]);

  const handleSelectRole = (role: UserRole) => {
    login(role);
    addToast('success', `Selamat datang, ${role === 'owner' ? 'Owner' : 'Admin Keuangan'}!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2e24] via-[#1d3d2e] to-[#0f1f18] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white mb-4 shadow-2xl overflow-hidden p-2">
            <img src={logo} alt="ARKA Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">ARKA</h1>
          <p className="text-white/50 text-sm">Finance Management System</p>
          <p className="text-white/30 text-xs mt-1">PT Aksara Riksa Perdana</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {!pinVerified ? (
            <div className="flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Masuk ke ARKA</h2>
              <p className="text-sm text-gray-500 mb-6 text-center">Masukkan PIN 6 digit Anda</p>

              {/* PIN Dots */}
              <div className="flex justify-center gap-4 mb-6">
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
                <div className="flex items-center gap-2 mb-6 text-red-600 text-sm bg-red-50 py-2 px-4 rounded-xl w-full justify-center">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Calculator Numpad Grid */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] sm:max-w-[320px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumberClick(num.toString())}
                    className="aspect-square rounded-full flex items-center justify-center text-2xl font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all duration-100 hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#299775]/50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="aspect-square rounded-full flex items-center justify-center text-base font-semibold text-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-100 transition-all duration-100 hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleNumberClick('0')}
                  className="aspect-square rounded-full flex items-center justify-center text-2xl font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 transition-all duration-100 hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#299775]/50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={pin.length !== 6 || loading}
                  onClick={handleConfirm}
                  className="aspect-square rounded-full flex items-center justify-center text-sm font-semibold text-white bg-[#299775] hover:bg-[#207a5e] active:bg-[#1b664f] transition-all duration-100 hover:scale-105 active:scale-95 shadow-md shadow-[#299775]/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:scale-100 disabled:border-transparent focus:outline-none focus:ring-2 focus:ring-[#299775]/50"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Pilih Role</h2>
              <p className="text-sm text-gray-500 mb-6">Masuk sebagai siapa hari ini?</p>

              <div className="space-y-3">
                <button
                  onClick={() => handleSelectRole('owner')}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl
                    hover:border-primary hover:bg-primary-light transition-all duration-200 group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center
                    group-hover:bg-accent/30 transition-colors">
                    <Crown size={24} className="text-accent-dark" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Owner</p>
                    <p className="text-sm text-gray-500">Approve transaksi & lihat ringkasan</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectRole('admin')}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-2xl
                    hover:border-primary hover:bg-primary-light transition-all duration-200 group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center
                    group-hover:bg-primary/30 transition-colors">
                    <Calculator size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Admin Keuangan</p>
                    <p className="text-sm text-gray-500">Kelola semua transaksi & laporan</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => { setPinVerified(false); setPin(''); }}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4 transition-colors"
              >
                ← Kembali
              </button>
            </>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © 2025 PT Aksara Riksa Perdana. All rights reserved.
        </p>
      </div>
    </div>
  );
}
