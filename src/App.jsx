import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell, Forbidden } from './components/layout/AppShell';
import { LoadingBlock } from './components/ui';
import { P } from './auth/permissions';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { ListenersPage } from './pages/ListenersPage';
import { ListenerDetailPage } from './pages/ListenerDetailPage';
import { LanguagesPage } from './pages/LanguagesPage';
import { AvatarsPage } from './pages/AvatarsPage';
import { OtpPage } from './pages/OtpPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PaymentDetailPage } from './pages/PaymentDetailPage';
import { PackagesPage } from './pages/PackagesPage';
import { WalletsPage } from './pages/WalletsPage';
import { EarningsPage } from './pages/EarningsPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { CallsPage } from './pages/CallsPage';
import { CallDetailPage } from './pages/CallDetailPage';
import { ModerationPage } from './pages/ModerationPage';
import { ModerationDetailPage } from './pages/ModerationDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { BonusesPage } from './pages/BonusesPage';
import { RbacPage } from './pages/RbacPage';
import { ConfigPage } from './pages/ConfigPage';
import { LegalPage } from './pages/LegalPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Requires a session; remembers where the admin was headed. */
function RequireAuth({ children }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingBlock label="Checking your session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

/**
 * Route-level permission gate. The API enforces the same permission, so this only
 * spares the admin a page that would answer 403 on every request.
 */
function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  return can(permission) ? children : <Forbidden />;
}

const guard = (permission, element) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={guard(P.DASHBOARD_READ, <DashboardPage />)} />

        <Route path="users" element={guard(P.USERS_READ, <UsersPage />)} />
        <Route path="users/:id" element={guard(P.USERS_READ, <UserDetailPage />)} />

        <Route path="listeners" element={guard(P.LISTENERS_READ, <ListenersPage />)} />
        <Route path="listeners/:id" element={guard(P.LISTENERS_READ, <ListenerDetailPage />)} />

        <Route path="languages" element={guard(P.LANGUAGES_READ, <LanguagesPage />)} />
        <Route path="avatars" element={guard(P.AVATARS_READ, <AvatarsPage />)} />
        <Route path="otp" element={guard(P.OTP_READ, <OtpPage />)} />

        <Route path="payments" element={guard(P.PAYMENTS_READ, <PaymentsPage />)} />
        <Route path="payments/:id" element={guard(P.PAYMENTS_READ, <PaymentDetailPage />)} />
        <Route path="packages" element={guard(P.PACKAGES_WRITE, <PackagesPage />)} />
        <Route path="wallets" element={guard(P.WALLET_READ, <WalletsPage />)} />
        <Route path="wallets/:userId" element={guard(P.WALLET_READ, <WalletsPage />)} />
        <Route path="earnings" element={guard(P.EARNINGS_READ, <EarningsPage />)} />
        <Route path="payouts" element={guard(P.PAYOUTS_READ, <PayoutsPage />)} />
        <Route path="bonuses" element={guard(P.BONUSES_READ, <BonusesPage />)} />

        <Route path="calls" element={guard(P.CALLS_READ, <CallsPage />)} />
        <Route path="calls/:id" element={guard(P.CALLS_READ, <CallDetailPage />)} />

        <Route path="moderation" element={guard(P.MODERATION_READ, <ModerationPage />)} />
        <Route
          path="moderation/:id"
          element={guard(P.MODERATION_READ, <ModerationDetailPage />)}
        />

        <Route
          path="notifications"
          element={guard(P.NOTIFICATIONS_READ, <NotificationsPage />)}
        />

        <Route path="config" element={guard(P.CONFIG_READ, <ConfigPage />)} />
        <Route path="legal" element={guard(P.LEGAL_READ, <LegalPage />)} />
        <Route path="rbac" element={guard(P.ADMINS_READ, <RbacPage />)} />
        <Route path="audit" element={guard(P.AUDIT_READ, <AuditPage />)} />
        <Route path="reports" element={guard(P.REPORTS_GENERATE, <ReportsPage />)} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
