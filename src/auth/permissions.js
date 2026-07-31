/**
 * Permission keys, mirroring `src/modules/admin/permissions.js` on the backend.
 *
 * These gate *navigation and affordances only*. The server enforces the same keys
 * on every route, so hiding a button here is a UX nicety, never a security
 * boundary - an admin who forges their way to a page still gets a 403 from the
 * API. Keeping the list in sync matters for usability: a missing key here means a
 * legitimate admin sees a page they cannot use.
 */
export const P = {
  DASHBOARD_READ: 'dashboard:read',
  REPORTS_GENERATE: 'reports:generate',

  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_BLOCK: 'users:block',

  LISTENERS_READ: 'listeners:read',
  LISTENERS_APPROVE: 'listeners:approve',
  LISTENERS_SUSPEND: 'listeners:suspend',

  OTP_READ: 'otp:read',
  OTP_UNLOCK: 'otp:unlock',

  LANGUAGES_READ: 'languages:read',
  LANGUAGES_WRITE: 'languages:write',
  LANGUAGES_DELETE: 'languages:delete',

  WALLET_READ: 'wallet:read',
  WALLET_ADJUST: 'wallet:adjust',

  PAYMENTS_READ: 'payments:read',
  PAYMENTS_REFUND: 'payments:refund',
  PACKAGES_WRITE: 'packages:write',

  EARNINGS_READ: 'earnings:read',
  PAYOUTS_READ: 'payouts:read',
  PAYOUTS_WRITE: 'payouts:write',

  CALLS_READ: 'calls:read',
  CALLS_TERMINATE: 'calls:terminate',

  MODERATION_READ: 'moderation:read',
  MODERATION_REVIEW: 'moderation:review',

  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_SEND: 'notifications:send',
  NOTIFICATIONS_TEMPLATES: 'notifications:templates',

  BONUSES_READ: 'bonuses:read',
  BONUSES_WRITE: 'bonuses:write',

  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',

  LEGAL_READ: 'legal:read',
  LEGAL_WRITE: 'legal:write',

  ADMINS_READ: 'admins:read',
  ADMINS_WRITE: 'admins:write',
  AUDIT_READ: 'audit:read',
};
