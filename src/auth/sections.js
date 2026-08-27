import { P } from './permissions';

/**
 * Dashboard sections — keys match backend `AdminDashboardSection` /
 * `GET /admin/sections`. Labels here are fallbacks; the create/edit form
 * prefers the catalogue from the API.
 */
export const S = {
  OVERVIEW: 'OVERVIEW',
  PEOPLE: 'PEOPLE',
  MONEY: 'MONEY',
  ACTIVITY: 'ACTIVITY',
  SYSTEM: 'SYSTEM',
};

/** First matching path an admin may land on after login / unauthorized redirect. */
export const SECTION_HOME_CANDIDATES = [
  { path: '/', section: S.OVERVIEW, permission: P.DASHBOARD_READ },
  { path: '/reports', section: S.OVERVIEW, permission: P.REPORTS_GENERATE },
  { path: '/users', section: S.PEOPLE, permission: P.USERS_READ },
  { path: '/listeners', section: S.PEOPLE, permission: P.LISTENERS_READ },
  { path: '/languages', section: S.PEOPLE, permission: P.LANGUAGES_READ },
  { path: '/avatars', section: S.PEOPLE, permission: P.AVATARS_READ },
  { path: '/otp', section: S.PEOPLE, permission: P.OTP_READ },
  { path: '/payments', section: S.MONEY, permission: P.PAYMENTS_READ },
  { path: '/packages', section: S.MONEY, permission: P.PACKAGES_WRITE },
  { path: '/wallets', section: S.MONEY, permission: P.WALLET_READ },
  { path: '/earnings', section: S.MONEY, permission: P.EARNINGS_READ },
  { path: '/payouts', section: S.MONEY, permission: P.PAYOUTS_READ },
  { path: '/bonuses', section: S.MONEY, permission: P.BONUSES_READ },
  { path: '/calls', section: S.ACTIVITY, permission: P.CALLS_READ },
  { path: '/moderation', section: S.ACTIVITY, permission: P.MODERATION_READ },
  { path: '/listener-blocks', section: S.ACTIVITY, permission: P.BLOCKS_READ },
  { path: '/account-deletion', section: S.ACTIVITY, permission: P.ACCOUNT_DELETION_READ },
  { path: '/notifications', section: S.ACTIVITY, permission: P.NOTIFICATIONS_READ },
  { path: '/config', section: S.SYSTEM, permission: P.CONFIG_READ },
  { path: '/legal', section: S.SYSTEM, permission: P.LEGAL_READ },
  { path: '/rbac', section: S.SYSTEM, permission: P.ADMINS_READ },
  { path: '/audit', section: S.SYSTEM, permission: P.AUDIT_READ },
];

export const NO_ACCESS_PATH = '/no-access';

export function firstAllowedPath({ can, canSection }) {
  for (const candidate of SECTION_HOME_CANDIDATES) {
    if (canSection(candidate.section) && can(candidate.permission)) {
      return candidate.path;
    }
  }
  return NO_ACCESS_PATH;
}
