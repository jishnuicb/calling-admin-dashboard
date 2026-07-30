import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-white text-emerald-800' },
  error: { icon: AlertCircle, className: 'border-red-200 bg-white text-red-800' },
  info: { icon: Info, className: 'border-ink-200 bg-white text-ink-800' },
};

/**
 * Minimal toast stack. Every mutation reports its outcome through here, so the
 * admin always gets confirmation that a destructive action actually landed -
 * important when the action is a refund or a wallet adjustment.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2);
      const entry = { id, tone: 'info', ...toast };
      setToasts((current) => [...current, entry]);
      // Errors stay longer: they usually carry a request id worth reading.
      const ttl = entry.tone === 'error' ? 8000 : 4500;
      setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, detail) => push({ tone: 'success', title, detail }),
      error: (titleOrError, detail) => {
        // Accepts an ApiError directly so call sites can just pass the catch arg.
        if (titleOrError && typeof titleOrError === 'object' && titleOrError.message) {
          return push({
            tone: 'error',
            title: titleOrError.message,
            detail: detail || titleOrError.requestId,
          });
        }
        return push({ tone: 'error', title: titleOrError, detail });
      },
      info: (title, detail) => push({ tone: 'info', title, detail }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const { icon: Icon, className } = TONES[toast.tone] || TONES.info;
          return (
            <div
              key={toast.id}
              className={clsx(
                'animate-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
                className,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.detail && (
                  <p className="mt-0.5 break-words font-mono text-[11px] opacity-75">
                    {toast.detail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-m-1 rounded p-1 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
};
