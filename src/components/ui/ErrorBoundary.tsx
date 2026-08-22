import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React UI error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-red-100 text-center space-y-4 animate-fade-in">
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

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
