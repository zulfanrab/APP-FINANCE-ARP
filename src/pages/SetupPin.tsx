// ============================================================
// ARKA Finance — Setup PIN Page
// ============================================================

import React, { useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import logo from '../assets/logo.png';
import { setupPin } from '../services/authService';
import { Button } from '../components/ui';
import { useApp } from '../context/AppContext';

interface SetupPinProps {
  onComplete: () => void;
}

export function SetupPin({ onComplete }: SetupPinProps) {
  const { addToast } = useApp();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      addToast('error', 'PIN harus 6 digit angka');
      return;
    }
    if (pin !== confirmPin) {
      addToast('error', 'PIN dan konfirmasi PIN tidak sama');
      return;
    }
    setLoading(true);
    try {
      await setupPin(pin);
      addToast('success', 'PIN berhasil dibuat! Silakan login.');
      onComplete();
    } catch {
      addToast('error', 'Gagal menyimpan PIN');
    } finally {
      setLoading(false);
    }
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
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Setup PIN</h2>
              <p className="text-sm text-gray-500">Buat PIN 6 digit untuk keamanan aplikasi</p>
            </div>
          </div>

          <form onSubmit={handleSetup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buat PIN (6 digit)
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-2xl tracking-[0.5em] text-center
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Konfirmasi PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-2xl tracking-[0.5em] text-center
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••"
              />
            </div>

            {/* PIN strength indicator */}
            <div className="flex gap-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300
                    ${i < pin.length ? 'bg-primary' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full py-3"
              size="lg"
            >
              Buat PIN & Lanjutkan
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            PIN disimpan secara terenkripsi di perangkat ini
          </p>
        </div>
      </div>
    </div>
  );
}
