import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React UI error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.removeItem('cached_transactions');
      localStorage.removeItem('cached_projects');
      sessionStorage.clear();
    } catch { /* ignore */ }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-red-100 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle size={32} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Terjadi Gangguan Tampilan</h2>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Aplikasi mendeteksi ketidaksesuaian data sementara. Tenang, seluruh data keuangan Anda tetap tersimpan aman di database.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-left">
                <p className="text-[11px] font-mono text-red-800 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {(this.state.errorInfo?.componentStack || this.state.error?.stack) && (
              <details className="text-left bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] text-slate-700 font-mono">
                <summary className="cursor-pointer font-bold text-slate-900 hover:text-emerald-700 select-none">
                  🔍 Lihat Detail Teknis Error
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-tight bg-slate-900 text-slate-100 p-2.5 rounded-lg">
                  {this.state.error?.stack || ''}
                  {this.state.errorInfo?.componentStack || ''}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Muat Ulang Halaman</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Home size={14} />
                  <span>Kembali ke Dashboard</span>
                </button>
              </div>
              <button
                type="button"
                onClick={this.handleClearCache}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all"
              >
                🧹 Bersihkan Cache Lokal &amp; Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
