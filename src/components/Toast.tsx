'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

interface ToastOptions {
  message?: string;
  duration?: number;
  /** Show the toast on the next page after a full page reload (window.location redirect). */
  afterReload?: boolean;
}

type ToastFn = (title: string, options?: ToastOptions) => void;

interface ToastApi {
  success: ToastFn;
  error: ToastFn;
  warning: ToastFn;
  info: ToastFn;
}

const PENDING_KEY = 'shreeji_pending_toast';
const MAX_VISIBLE = 4;

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 6000,
};

const STYLES: Record<ToastType, { bar: string; icon: string; bg: string }> = {
  success: { bar: 'bg-positive', icon: 'text-positive', bg: 'bg-positive/10' },
  error: { bar: 'bg-negative', icon: 'text-negative', bg: 'bg-negative/10' },
  warning: { bar: 'bg-warning', icon: 'text-warning', bg: 'bg-warning/10' },
  info: { bar: 'bg-online', icon: 'text-online', bg: 'bg-online/10' },
};

const ToastContext = createContext<ToastApi | null>(null);

function ToastIcon({ type }: { type: ToastType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (type === 'success') {
    return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
  }
  if (type === 'error') {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>;
  }
  if (type === 'warning') {
    return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>;
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const style = STYLES[toast.type];

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), toast.duration);
    const remove = setTimeout(() => onClose(toast.id), toast.duration + 200);
    return () => {
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={clsx(
        'pointer-events-auto relative overflow-hidden flex items-start gap-3 w-full rounded-card border border-line bg-panel pl-4 pr-2 py-3 shadow-lg',
        leaving ? 'toast-leave' : 'toast-enter',
      )}
    >
      <span className={clsx('absolute left-0 top-0 h-full w-1', style.bar)} />
      <span className={clsx('mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full', style.bg, style.icon)}>
        <ToastIcon type={toast.type} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14px] font-semibold text-ink break-words">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-[13px] text-muted break-words">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper hover:text-ink"
        aria-label="Close notification"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>
      </button>
      <span
        className={clsx('toast-progress absolute bottom-0 left-0 h-0.5 opacity-60', style.bar)}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, title: string, options: ToastOptions = {}) => {
    const item: ToastItem = {
      id: nextId.current++,
      type,
      title,
      message: options.message,
      duration: options.duration ?? DEFAULT_DURATION[type],
    };
    if (options.afterReload && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ type, title, message: options.message }));
        return;
      } catch {}
    }
    setToasts(list =>
      [...list.filter(t => !(t.type === type && t.title === title && t.message === options.message)), item].slice(-MAX_VISIBLE),
    );
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_KEY);
      const pending = JSON.parse(raw) as { type?: ToastType; title?: string; message?: string };
      if (pending.title && pending.type && pending.type in DEFAULT_DURATION) {
        push(pending.type, pending.title, { message: pending.message });
      }
    } catch {}
  }, [push]);

  const api = useMemo<ToastApi>(() => ({
    success: (title, options) => push('success', title, options),
    error: (title, options) => push('error', title, options),
    warning: (title, options) => push('warning', title, options),
    info: (title, options) => push('info', title, options),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-96"
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
