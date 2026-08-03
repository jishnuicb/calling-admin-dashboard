import { forwardRef, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { AlertCircle, Check, ChevronDown, Loader2, Search, X } from 'lucide-react';

/* =========================================================================
 * Primitives shared by every page. Deliberately small and unopinionated: each
 * one forwards unknown props to the underlying element so pages can extend
 * without new variants being added here.
 * ========================================================================= */

// --- Button -----------------------------------------------------------------

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary:
    'bg-white text-ink-700 ring-1 ring-inset ring-ink-300 hover:bg-ink-50 focus-visible:outline-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-ink-400',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:outline-brand-500',
};

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-2',
  lg: 'px-4 py-2.5 text-sm gap-2',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

// --- Form fields ------------------------------------------------------------

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 flex items-start gap-1 text-xs text-red-600">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      )}
    </label>
  );
}

const inputBase =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm ' +
  'ring-1 ring-inset ring-ink-300 placeholder:text-ink-400 ' +
  'focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-ink-100 disabled:text-ink-500';

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(inputBase, invalid && 'ring-red-400 focus:ring-red-500', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(inputBase, 'resize-y', invalid && 'ring-red-400', className)}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, invalid, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={clsx(inputBase, 'appearance-none pr-9', invalid && 'ring-red-400', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
});

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(inputBase, 'pl-9')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Checkbox({ label, description, checked, onChange, disabled, className }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5', className)}>
      <span
        className={clsx(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition',
          checked ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white',
          disabled && 'opacity-50',
        )}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        {label && <span className="block text-sm text-ink-800">{label}</span>}
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-ink-300',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </button>
      {label && <span className="text-sm text-ink-700">{label}</span>}
    </label>
  );
}

// --- Surfaces ---------------------------------------------------------------

export function Card({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section
      className={clsx('rounded-xl border border-ink-200 bg-white shadow-sm', className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(bodyClassName ?? 'p-5')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- Badges -----------------------------------------------------------------

const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function Badge({ tone = 'neutral', children, className, dot }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * Maps every backend status enum to a tone, so the same value always looks the
 * same wherever it appears. Unknown values fall back to neutral rather than
 * throwing, which keeps the UI resilient if the backend adds an enum member.
 */
const STATUS_TONES = {
  ACTIVE: 'success',
  APPROVED: 'success',
  SUCCESS: 'success',
  SENT: 'success',
  RESOLVED: 'success',
  ENDED: 'success',
  COMPLETED: 'success',

  PENDING: 'warning',
  UNDER_REVIEW: 'warning',
  QUEUED: 'warning',
  CREATED: 'warning',
  RINGING: 'warning',
  REFUND_PENDING: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  DRY_RUN: 'warning',

  BLOCKED: 'danger',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  FAILED: 'danger',
  DELETED: 'danger',
  DISABLED: 'danger',
  TERMINATED: 'danger',
  CANCELLED: 'danger',

  MISSED: 'neutral',
  SKIPPED: 'neutral',
  REVOKED: 'neutral',
  EXPIRED: 'neutral',

  LIVE: 'info',
  REFUNDED: 'info',
};

export function StatusBadge({ status, className }) {
  if (!status) return <span className="text-ink-400">—</span>;
  const tone = STATUS_TONES[status] || 'neutral';
  return (
    <Badge tone={tone} dot className={className}>
      {String(status).replace(/_/g, ' ').toLowerCase()}
    </Badge>
  );
}

// --- Feedback ---------------------------------------------------------------

export function Spinner({ className }) {
  return <Loader2 className={clsx('size-5 animate-spin text-brand-600', className)} />;
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 py-14', className)}>
      <Spinner />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100">
          <Icon className="size-5 text-ink-400" />
        </span>
      )}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Error surface for a failed query or mutation.
 *
 * Shows the API's human-readable `message`, the machine `code`, and the
 * `requestId` - that last one is what makes a user's screenshot actionable,
 * because it locates the exact request in the backend logs.
 */
export function ErrorState({ error, onRetry, compact }) {
  if (!error) return null;
  return (
    <div
      className={clsx(
        'rounded-lg border border-red-200 bg-red-50 text-red-800',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className={clsx('font-medium', compact ? 'text-xs' : 'text-sm')}>{error.message}</p>
          {(error.code || error.requestId) && (
            <p className="mt-1 truncate font-mono text-[11px] text-red-600/80">
              {error.code}
              {error.requestId ? ` · ${error.requestId}` : ''}
            </p>
          )}
          {Array.isArray(error.details) && error.details.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-red-700">
              {error.details.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.field || d.source}</span>: {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Modal ------------------------------------------------------------------

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={clsx(
          'animate-fade-in-up relative my-8 w-full rounded-xl overflow-hidden bg-white shadow-xl',
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            '-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
            active === tab.id
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-700',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-600">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// --- Description list (detail pages) ---------------------------------------

export function DescList({ items, columns = 2, className }) {
  return (
    <dl
      className={clsx(
        'grid gap-x-6 gap-y-4',
        columns === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
        className,
      )}
    >
      {items
        .filter(Boolean)
        .map(({ label, value, mono, full }, i) => (
          <div key={i} className={clsx(full && 'sm:col-span-2')}>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
            <dd
              className={clsx(
                'mt-1 break-words text-sm text-ink-900',
                mono && 'font-mono text-xs',
              )}
            >
              {value === null || value === undefined || value === '' ? (
                <span className="text-ink-400">—</span>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** Pretty-printed JSON, for audit before/after snapshots and webhook payloads. */
export function JsonBlock({ value, className, maxHeight = '20rem' }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-ink-400">—</span>;
  }
  return (
    <pre
      className={clsx(
        'overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] leading-relaxed text-ink-100',
        className,
      )}
      style={{ maxHeight }}
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
