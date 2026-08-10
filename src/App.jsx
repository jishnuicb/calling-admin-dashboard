import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell, Forbidden, NoAccess } from './components/layout/AppShell';
import { LoadingBlock } from './components/ui';
import { P } from './auth/permissions';
import { S, firstAllowedPath, NO_ACCESS_PATH } from './auth/sections';

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
 * Route-level section + permission gate. Unauthorized pages never render —
 * including on direct URL entry or programmatic navigation.
 */
function RequireAccess({ section, permission, children }) {
  const { can, canSection } = useAuth();

  if (!canSection(section)) {
    const home = firstAllowedPath({ can, canSection });
    if (home === NO_ACCESS_PATH) return <NoAccess />;
    return <Navigate to={home} replace />;
  }

  if (!can(permission)) return <Forbidden />;
  return children;
}

const guard = (section, permission, element) => (
  <RequireAccess section={section} permission={permission}>
    {element}
  </RequireAccess>
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
        <Route index element={guard(S.OVERVIEW, P.DASHBOARD_READ, <DashboardPage />)} />

        <Route path="users" element={guard(S.PEOPLE, P.USERS_READ, <UsersPage />)} />
        <Route path="users/:id" element={guard(S.PEOPLE, P.USERS_READ, <UserDetailPage />)} />

        <Route path="listeners" element={guard(S.PEOPLE, P.LISTENERS_READ, <ListenersPage />)} />
        <Route
          path="listeners/:id"
          element={guard(S.PEOPLE, P.LISTENERS_READ, <ListenerDetailPage />)}
        />

        <Route path="languages" element={guard(S.PEOPLE, P.LANGUAGES_READ, <LanguagesPage />)} />
        <Route path="avatars" element={guard(S.PEOPLE, P.AVATARS_READ, <AvatarsPage />)} />
        <Route path="otp" element={guard(S.PEOPLE, P.OTP_READ, <OtpPage />)} />

        <Route path="payments" element={guard(S.MONEY, P.PAYMENTS_READ, <PaymentsPage />)} />
        <Route path="payments/:id" element={guard(S.MONEY, P.PAYMENTS_READ, <PaymentDetailPage />)} />
        <Route path="packages" element={guard(S.MONEY, P.PACKAGES_WRITE, <PackagesPage />)} />
        <Route path="wallets" element={guard(S.MONEY, P.WALLET_READ, <WalletsPage />)} />
        <Route path="wallets/:userId" element={guard(S.MONEY, P.WALLET_READ, <WalletsPage />)} />
        <Route path="earnings" element={guard(S.MONEY, P.EARNINGS_READ, <EarningsPage />)} />
        <Route path="payouts" element={guard(S.MONEY, P.PAYOUTS_READ, <PayoutsPage />)} />
        <Route path="bonuses" element={guard(S.MONEY, P.BONUSES_READ, <BonusesPage />)} />

        <Route path="calls" element={guard(S.ACTIVITY, P.CALLS_READ, <CallsPage />)} />
        <Route path="calls/:id" element={guard(S.ACTIVITY, P.CALLS_READ, <CallDetailPage />)} />

        <Route path="moderation" element={guard(S.ACTIVITY, P.MODERATION_READ, <ModerationPage />)} />
        <Route
          path="moderation/:id"
          element={guard(S.ACTIVITY, P.MODERATION_READ, <ModerationDetailPage />)}
        />

        <Route
          path="notifications"
          element={guard(S.ACTIVITY, P.NOTIFICATIONS_READ, <NotificationsPage />)}
        />

        <Route path="config" element={guard(S.SYSTEM, P.CONFIG_READ, <ConfigPage />)} />
        <Route path="legal" element={guard(S.SYSTEM, P.LEGAL_READ, <LegalPage />)} />
        <Route path="rbac" element={guard(S.SYSTEM, P.ADMINS_READ, <RbacPage />)} />
        <Route path="audit" element={guard(S.SYSTEM, P.AUDIT_READ, <AuditPage />)} />
        <Route path="reports" element={guard(S.OVERVIEW, P.REPORTS_GENERATE, <ReportsPage />)} />

        <Route path="no-access" element={<NoAccess />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
