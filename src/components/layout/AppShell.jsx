import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  ClipboardList,
  Coins,
  CreditCard,
  Flag,
  Gift,
  KeyRound,
  Languages,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Ban,
  Package,
  PhoneCall,
  ScrollText,
  Settings,
  ShieldCheck,
  Banknote,
  IndianRupee,
  Scale,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { P } from '../../auth/permissions';
import { S, firstAllowedPath } from '../../auth/sections';
import { Badge, Button, Modal, Field, Input, ErrorState } from '../ui';
import { useToast } from '../ui/Toast';
import { authApi } from '../../api/endpoints';

/**
 * Navigation is section- then permission-filtered. Unauthorized sections are
 * omitted entirely (not shown disabled). The API enforces the same rules.
 */
const NAV_SECTIONS = [
  {
    key: S.OVERVIEW,
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: P.DASHBOARD_READ, end: true },
      { to: '/reports', label: 'Reports', icon: BarChart3, permission: P.REPORTS_GENERATE },
    ],
  },
  {
    key: S.PEOPLE,
    title: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: P.USERS_READ },
      { to: '/listeners', label: 'Listener applications', icon: BadgeCheck, permission: P.LISTENERS_READ },
      { to: '/languages', label: 'Language master', icon: Languages, permission: P.LANGUAGES_READ },
      { to: '/avatars', label: 'Profile avatars', icon: ImagePlus, permission: P.AVATARS_READ },
      { to: '/otp', label: 'OTP & lockouts', icon: KeyRound, permission: P.OTP_READ },
    ],
  },
  {
    key: S.MONEY,
    title: 'Money',
    items: [
      { to: '/payments', label: 'Payments', icon: CreditCard, permission: P.PAYMENTS_READ },
      { to: '/packages', label: 'Token packages', icon: Package, permission: P.PACKAGES_WRITE },
      { to: '/wallets', label: 'Wallets', icon: Coins, permission: P.WALLET_READ },
      { to: '/earnings', label: 'Listener earnings', icon: IndianRupee, permission: P.EARNINGS_READ },
      { to: '/payouts', label: 'Listener payouts', icon: Banknote, permission: P.PAYOUTS_READ },
      { to: '/bonuses', label: 'Bonuses', icon: Gift, permission: P.BONUSES_READ },
    ],
  },
  {
    key: S.ACTIVITY,
    title: 'Activity',
    items: [
      { to: '/calls', label: 'Calls', icon: PhoneCall, permission: P.CALLS_READ },
      { to: '/moderation', label: 'Moderation', icon: Flag, permission: P.MODERATION_READ },
      { to: '/listener-blocks', label: 'Listener blocks', icon: Ban, permission: P.BLOCKS_READ },
      {
        to: '/account-deletion',
        label: 'Account deletion',
        icon: UserX,
        permission: P.ACCOUNT_DELETION_READ,
      },
      { to: '/notifications', label: 'Notifications', icon: Bell, permission: P.NOTIFICATIONS_READ },
    ],
  },
  {
    key: S.SYSTEM,
    title: 'System',
    items: [
      { to: '/config', label: 'Configuration', icon: Settings, permission: P.CONFIG_READ },
      { to: '/legal', label: 'Legal documents', icon: Scale, permission: P.LEGAL_READ },
      { to: '/rbac', label: 'Admins & roles', icon: ShieldCheck, permission: P.ADMINS_READ },
      { to: '/audit', label: 'Audit log', icon: ScrollText, permission: P.AUDIT_READ },
    ],
  },
];

function SidebarContent({ onNavigate }) {
  const { can, canSection } = useAuth();

  const sections = NAV_SECTIONS.filter((section) => canSection(section.key))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          VP
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Voice Platform</p>
          <p className="truncate text-[11px] text-ink-400">Admin console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                        isActive
                          ? 'bg-brand-600/15 font-medium text-white'
                          : 'text-ink-300 hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {sections.length === 0 && (
          <p className="px-2 text-xs text-ink-400">
            Your account has no dashboard sections. Ask a super admin to grant access.
          </p>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <a
          href="/api-docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-ink-400 hover:bg-white/5 hover:text-white"
        >
          <ClipboardList className="size-4" />
          API documentation
        </a>
      </div>
    </div>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.newPassword !== form.confirm) {
      setError({ message: 'The new password and confirmation do not match.' });
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const fieldErrors = error?.fieldErrors || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      description="Admin passwords need 10+ characters with upper, lower, digit and symbol."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Change password
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorState error={error} compact />}
        <Field label="Current password" required error={fieldErrors.currentPassword}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
        </Field>
        <Field label="New password" required error={fieldErrors.newPassword}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </Field>
        <Field label="Confirm new password" required>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <p className="text-xs text-ink-500">
          Changing your password revokes your other sessions, so you will stay signed in here
          only.
        </p>
      </form>
    </Modal>
  );
}

export function AppShell() {
  const { admin, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-ink-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-ink-400 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            {isSuperAdmin && <Badge tone="brand">Super admin</Badge>}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink-100"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {(admin?.name || admin?.email || '?').slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-medium leading-tight text-ink-800">
                    {admin?.name || admin?.email}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-500">
                    {admin?.role?.name || '—'}
                  </span>
                </span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="animate-fade-in-up absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg">
                    <div className="border-b border-ink-100 px-3.5 py-2.5">
                      <p className="truncate text-xs font-medium text-ink-800">{admin?.email}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {admin?.permissions?.length || 0} permissions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setPasswordOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <ShieldCheck className="size-4 text-ink-400" />
                      Change password
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2 border-t border-ink-100 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

/** Shown when an admin reaches a route their role/section does not cover. */
export function Forbidden() {
  const { can, canSection } = useAuth();
  const home = firstAllowedPath({ can, canSection });

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
        <ShieldCheck className="size-6 text-amber-600" />
      </span>
      <h1 className="text-lg font-semibold text-ink-900">You do not have access to this section</h1>
      <p className="mt-2 text-sm text-ink-500">
        Your account is missing the section permission this page requires. A super admin can grant
        it under Admins &amp; roles.
      </p>
      <Link
        to={home}
        className="mt-5 inline-block text-sm font-medium text-brand-600 hover:underline"
      >
        {home === '/no-access' ? 'View access status' : 'Go to an allowed page'}
      </Link>
    </div>
  );
}

/** Dedicated landing when the admin has no assigned dashboard sections. */
export function NoAccess() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
        <ShieldCheck className="size-6 text-amber-600" />
      </span>
      <h1 className="text-lg font-semibold text-ink-900">No dashboard access</h1>
      <p className="mt-2 text-sm text-ink-500">
        Your admin account has no section permissions. Ask a super admin to assign Overview,
        People, Money, Activity, or System access.
      </p>
    </div>
  );
}
