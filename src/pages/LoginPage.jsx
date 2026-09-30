import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { firstAllowedPath } from '../auth/sections';
import { Button, ErrorState, Field, Input, LoadingBlock } from '../components/ui';

function homeForAdmin(admin) {
  const isSuperAdmin = Boolean(admin?.isSuperAdmin);
  const permissions = new Set(admin?.permissions || []);
  const sections = new Set(admin?.sections || []);
  const can = (...required) =>
    isSuperAdmin || required.flat().filter(Boolean).some((key) => permissions.has(key));
  const canSection = (...required) =>
    isSuperAdmin || required.flat().filter(Boolean).some((key) => sections.has(key));
  return firstAllowedPath({ can, canSection });
}

export function LoginPage() {
  const { login, isAuthenticated, status, expiryNotice, can, canSection } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingBlock label="Restoring session…" />
      </div>
    );
  }

  if (isAuthenticated) {
    const home = firstAllowedPath({ can, canSection });
    const requested = location.state?.from;
    // Route guards block unauthorized deep-links; default to first allowed section.
    return <Navigate to={requested || home} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const admin = await login(form);
      const home = homeForAdmin(admin);
      navigate(location.state?.from || home, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErrors = error?.fieldErrors || {};

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            VP
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">
            Voice Platform Admin
          </h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to the admin console</p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
        >
          {expiryNotice && !error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {expiryNotice}
            </div>
          )}

          {error && <ErrorState error={error} compact />}

          <Field label="Email" required error={fieldErrors.email}>
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="admin@voiceplatform.local"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              invalid={Boolean(fieldErrors.email)}
            />
          </Field>

          <Field label="Password" required error={fieldErrors.password}>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              invalid={Boolean(fieldErrors.password)}
            />
          </Field>

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            <KeyRound className="size-4" />
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-500">
          Admin accounts are separate from app users. Credentials come from the backend seed
          (<code className="font-mono">SEED_ADMIN_EMAIL</code>) or from another admin.
        </p>
      </div>
    </div>
  );
}
