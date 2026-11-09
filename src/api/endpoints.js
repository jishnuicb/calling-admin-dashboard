import { api, get, post, put, patch, del, downloadCsv, downloadBlobPost } from './client';

/**
 * Every admin endpoint the backend exposes, grouped by module to mirror
 * `src/modules/**` on the server and the folder structure of the Swagger tags.
 *
 * Keeping them all here rather than inline in components means the API surface is
 * greppable from one file, and a backend route change has exactly one place to be
 * reflected. Query params are passed through as plain objects; `undefined` values
 * are dropped by axios, so callers can spread filter state directly.
 */

// --- Auth -------------------------------------------------------------------

export const authApi = {
  login: (body) => post('/admin/auth/login', body, { skipAuth: true }),
  refresh: (refreshToken) => post('/admin/auth/refresh', { refreshToken }, { skipAuth: true }),
  logout: (allSessions = false) => post('/admin/auth/logout', { allSessions }),
  me: () => get('/admin/auth/me'),
  changePassword: (body) => post('/admin/auth/password', body),
};

// --- Dashboard --------------------------------------------------------------

export const dashboardApi = {
  get: (params) => get('/admin/dashboard', params),
};

// --- Users ------------------------------------------------------------------

export const usersApi = {
  list: (params) => get('/admin/users', params),
  get: (id) => get(`/admin/users/${id}`),
  onlineCallers: () => get('/admin/users/online-callers'),
  updateName: (id, body) => patch(`/admin/users/${id}/name`, body),
  setBlocked: (id, body) => post(`/admin/users/${id}/block`, body),
  delete: (id, body) => del(`/admin/users/${id}`, { data: body }),
  revealPhone: (id, body) => post(`/admin/users/${id}/phone/reveal`, body),
  getBackupOtp: (id) => get(`/admin/users/${id}/backup-otp`),
  generateBackupOtp: (id) => post(`/admin/users/${id}/backup-otp/generate`),
  setPaymentMarket: (id, body) => put(`/admin/users/${id}/payment-market`, body),
};

// --- Listener applications --------------------------------------------------

export const listenersApi = {
  list: (params) => get('/admin/listeners/applications', params),
  exportCsv: (body) =>
    downloadBlobPost(
      '/admin/listeners/applications/export',
      body,
      'listeners-export.csv',
    ),
  get: (id) => get(`/admin/listeners/applications/${id}`),
  approve: (id, body) => post(`/admin/listeners/applications/${id}/approve`, body),
  reject: (id, body) => post(`/admin/listeners/applications/${id}/reject`, body),
  suspend: (id, body) => post(`/admin/listeners/applications/${id}/suspend`, body),
  forceOffline: (id) => post(`/admin/listeners/applications/${id}/force-offline`),
  reactivate: (id, body) => post(`/admin/listeners/applications/${id}/reactivate`, body),
  reopen: (id, body) => post(`/admin/listeners/applications/${id}/reopen`, body),
  professionalVerify: (id) => post(`/admin/listeners/applications/${id}/professional-verify`),
  revealBank: (id, body) => post(`/admin/listeners/applications/${id}/bank-details/reveal`, body),
  revealPhone: (id, body) => post(`/admin/listeners/applications/${id}/phone/reveal`, body),
  addNotes: (id, body) => post(`/admin/listeners/applications/${id}/notes`, body),
  updateDisplayName: (id, body) =>
    patch(`/admin/listeners/applications/${id}/display-name`, body),
  updateProfile: (id, body) => patch(`/admin/listeners/applications/${id}/profile`, body),
  uploadPhoto: (id, formData) =>
    api.post(`/admin/listeners/applications/${id}/photo`, formData, {
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers === 'object') {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
  clearPhoto: (id) => del(`/admin/listeners/applications/${id}/photo`),
  syncBeneficiary: (id, body) =>
    post(`/admin/listeners/applications/${id}/beneficiary/sync`, body || {}),
  getOnlineTime: (params) => get('/admin/listeners/online-time', params),
  getListenerOnlineTime: (id, params) => get(`/admin/listeners/${id}/online-time`, params),
  getCallingTime: (params) => get('/admin/listeners/calling-time', params),
  getListenerCallingTime: (id, params) => get(`/admin/listeners/${id}/calling-time`, params),
  listShifts: (params) => get('/admin/listeners/shifts', params),
  getShift: (id) => get(`/admin/listeners/shifts/${id}`),
  createShift: (body) => post('/admin/listeners/shifts', body),
  updateShift: (id, body) => patch(`/admin/listeners/shifts/${id}`, body),
  removeShift: (id) => del(`/admin/listeners/shifts/${id}`),
  listDecoys: () => get('/admin/listeners/decoys'),
  addDecoy: (body) => post('/admin/listeners/decoys', body),
  removeDecoy: (listenerId) => del(`/admin/listeners/decoys/${listenerId}`),
  syncDecoys: () => post('/admin/listeners/decoys/sync'),
  upsertDecoyIdentities: (listenerId, body) =>
    put(`/admin/listeners/decoys/${listenerId}/identities`, body),
  uploadDecoyIdentityPhoto: (listenerId, slotIndex, formData) =>
    api.post(`/admin/listeners/decoys/${listenerId}/identities/${slotIndex}/photo`, formData, {
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers === 'object') {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
};

export const professionsApi = {
  list: (params) => get('/admin/professions', params),
};

export const securityApi = {
  sensitiveKeyStatus: () => get('/admin/security/sensitive-key/status'),
  unlockSensitiveKey: (body) => post('/admin/security/sensitive-key/unlock', body),
  lockSensitiveKey: () => post('/admin/security/sensitive-key/lock'),
  listIpBlocks: (params) => get('/admin/security/ip-blocks', params),
  blockIp: (body) => post('/admin/security/ip-blocks', body),
  unblockIp: (id) => post(`/admin/security/ip-blocks/${id}/unblock`),
  ipBlockSettings: () => get('/admin/security/ip-blocks/settings'),
};

// --- Listener earnings & Cashfree payouts -----------------------------------

export const earningsApi = {
  list: (params) => get('/admin/earnings', params),
  summary: (params) => get('/admin/earnings/summary', params),
};

export const payoutsApi = {
  list: (params) => get('/admin/payouts', params),
  get: (id) => get(`/admin/payouts/${id}`),
  create: (body) => post('/admin/payouts', body),
  process: (id) => post(`/admin/payouts/${id}/process`),
  markPaid: (id, body) => post(`/admin/payouts/${id}/mark-paid`, body),
  cancel: (id) => post(`/admin/payouts/${id}/cancel`),
  runSchedule: (body) => post('/admin/payouts/run', body),
};

// --- OTP request state / lockouts -------------------------------------------

export const otpApi = {
  // `lockedCount` plus the effective policy, which is what the page header shows.
  summary: () => get('/admin/otp/summary'),
  // Defaults to locked-only on the server; pass `locked: false` for numbers that
  // are merely throttled.
  locks: (params) => get('/admin/otp/locks', params),
  // Clears the lock and resets the counter. 400 OTP_NOT_LOCKED if already clear.
  unlock: (id) => post(`/admin/otp/locks/${id}/unlock`),
  // IP access log for /auth/otp/send and /auth/otp/verify only.
  ipLogs: (params) => get('/admin/otp/ip-logs', params),
  allowedCountries: () => get('/admin/otp/allowed-countries'),
  addAllowedCountry: (body) => post('/admin/otp/allowed-countries', body),
  removeAllowedCountry: (id) => del(`/admin/otp/allowed-countries/${id}`),
};

// --- App crashes (Crashlytics → BigQuery) -----------------------------------

export const crashesApi = {
  list: (params) => get('/admin/crashes', params),
};

// --- Language master --------------------------------------------------------

export const languagesApi = {
  list: (params) => get('/admin/languages', params),
  create: (body) => post('/admin/languages', body),
  update: (id, body) => patch(`/admin/languages/${id}`, body),
  // Returns 409 LANGUAGE_IN_USE while any listener references the language.
  remove: (id) => del(`/admin/languages/${id}`),
  uploadIllustration: (id, formData) =>
    api.post(`/admin/languages/${id}/illustration`, formData, {
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers === 'object') {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
  clearIllustration: (id) => del(`/admin/languages/${id}/illustration`),
};

// --- Profile avatars (USER / LISTENER catalogs by gender) -------------------

export const avatarsApi = {
  list: (params) => get('/admin/avatars', params),
  create: (body) => post('/admin/avatars', body),
  upload: (formData) =>
    api
      .post('/admin/avatars/upload', formData, {
        // Let the browser set multipart boundary (default JSON Content-Type breaks uploads).
        transformRequest: [
          (data, headers) => {
            if (headers && typeof headers === 'object') {
              delete headers['Content-Type'];
            }
            return data;
          },
        ],
      })
      .then((r) => r.data),
  update: (id, body) => patch(`/admin/avatars/${id}`, body),
  remove: (id) => del(`/admin/avatars/${id}`),
};

// --- Wallets ----------------------------------------------------------------

export const walletApi = {
  get: (userId) => get(`/admin/wallets/${userId}`),
  history: (userId, params) => get(`/admin/wallets/${userId}/history`, params),
  adjust: (userId, body) => post(`/admin/wallets/${userId}/adjust`, body),
  reconcile: (userId, body) => post(`/admin/wallets/${userId}/reconcile`, body),
};

// --- Payments ---------------------------------------------------------------

export const paymentsApi = {
  list: (params) => get('/admin/payments', params),
  get: (id) => get(`/admin/payments/${id}`),
  refund: (id, body) => post(`/admin/payments/${id}/refund`, body),
  report: (params) => get('/admin/payments/report', params),
  downloadReport: (params) => downloadCsv('/admin/payments/report', params, 'payments-report.csv'),
};

export const paymentGatewaysApi = {
  list: () => get('/admin/payments/gateways'),
  update: (id, body) => patch(`/admin/payments/gateways/${id}`, body),
  uploadImage: (id, formData) =>
    api.post(`/admin/payments/gateways/${id}/image`, formData, {
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers === 'object') {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
  clearImage: (id) => del(`/admin/payments/gateways/${id}/image`),
};

// --- Token packages ---------------------------------------------------------

export const packagesApi = {
  list: () => get('/admin/packages'),
  create: (body) => post('/admin/packages', body),
  update: (id, body) => patch(`/admin/packages/${id}`, body),
  deactivate: (id) => post(`/admin/packages/${id}/deactivate`),
  syncAppStore: (id) => post(`/admin/packages/${id}/sync-app-store`),
  remove: (id) => del(`/admin/packages/${id}`),
};

// --- Calls ------------------------------------------------------------------

export const callsApi = {
  list: (params) => get('/admin/calls', params),
  get: (id) => get(`/admin/calls/${id}`),
  terminate: (id, body) => post(`/admin/calls/${id}/terminate`, body),
  report: (params) => get('/admin/calls/report', params),
  downloadReport: (params) => downloadCsv('/admin/calls/report', params, 'calls-report.csv'),
};

// --- Moderation (user reports) ---------------------------------------------

export const moderationApi = {
  list: (params) => get('/admin/moderation/reports', params),
  get: (id) => get(`/admin/moderation/reports/${id}`),
  review: (id, body) => post(`/admin/moderation/reports/${id}/review`, body),
};

// --- Listener → caller blocks (admin-managed) ------------------------------

export const blocksApi = {
  list: (params) => get('/admin/listener-blocks', params),
  create: (body) => post('/admin/listener-blocks', body),
  remove: (id) => del(`/admin/listener-blocks/${id}`),
};

// --- Account deletion requests ---------------------------------------------

export const accountDeletionApi = {
  list: (params) => get('/admin/account-deletion-requests', params),
  approve: (id, body) => post(`/admin/account-deletion-requests/${id}/approve`, body),
  reject: (id, body) => post(`/admin/account-deletion-requests/${id}/reject`, body),
};

// --- Notifications ----------------------------------------------------------

export const notificationsApi = {
  templates: () => get('/admin/notifications/templates'),
  upsertTemplate: (key, body) => put(`/admin/notifications/templates/${key}`, body),
  send: (body) => post('/admin/notifications/send', body),
  sendToUser: (userId, body) => post(`/admin/notifications/users/${userId}/send`, body),
  history: (params) => get('/admin/notifications/history', params),
};

// --- Card Guess -------------------------------------------------------------

export const cardGuessApi = {
  settings: () => get('/admin/card-guess/settings'),
  updateSettings: (body) => put('/admin/card-guess/settings', body),
  rounds: (params) => get('/admin/card-guess/rounds', params),
  leaderboard: (params) => get('/admin/card-guess/leaderboard', params),
  weeklyLeaderboard: (params) => get('/admin/card-guess/leaderboard/weekly', params),
};

// --- Bonuses ----------------------------------------------------------------

export const bonusesApi = {
  weeklyRuns: (params) => get('/admin/bonuses/weekly/runs', params),
  weeklyAwards: (id, params) => get(`/admin/bonuses/weekly/runs/${id}/awards`, params),
  weeklySettings: () => get('/admin/bonuses/weekly/settings'),
  updateWeeklySettings: (body) => put('/admin/bonuses/weekly/settings', body),
  runWeekly: (body) => post('/admin/bonuses/weekly/run', body),
};

// --- Listener referrals -----------------------------------------------------

export const referralsApi = {
  list: (params) => get('/admin/referrals', params),
  create: (body) => post('/admin/referrals', body),
  get: (id) => get(`/admin/referrals/${id}`),
  update: (id, body) => patch(`/admin/referrals/${id}`, body),
  stop: (id, body) => post(`/admin/referrals/${id}/stop`, body),
  revert: (id, body) => post(`/admin/referrals/${id}/revert`, body),
  resume: (id, body) => post(`/admin/referrals/${id}/resume`, body),
  remove: (id) => del(`/admin/referrals/${id}`),
  addIncentiveWeeks: (id, body) => post(`/admin/referrals/${id}/incentive-weeks`, body),
  updateIncentiveWeek: (id, weekId, body) =>
    patch(`/admin/referrals/${id}/incentive-weeks/${weekId}`, body),
  bonusSettings: () => get('/admin/referrals/bonus-settings'),
  updateBonusSettings: (body) => put('/admin/referrals/bonus-settings', body),
  referralReport: (params) => get('/admin/referrals/reports/referrals', params),
  weeklyIncentiveReport: (params) => get('/admin/referrals/reports/weekly-incentives', params),
  incentives: (params) => get('/admin/referrals/incentives', params),
  /** Standalone admin incentive for one or more IST weeks (type=INCENTIVE). */
  createIncentive: (body) => post('/admin/referrals/incentives', body),
  revertIncentive: (id, body) => post(`/admin/referrals/incentives/${id}/revert`, body),
  disableIncentive: (id, body) => post(`/admin/referrals/incentives/${id}/disable`, body),
  removeIncentive: (id) => del(`/admin/referrals/incentives/${id}`),
  exportReferralReport: (params) =>
    downloadCsv('/admin/referrals/reports/referrals', params, 'referral-report.csv'),
  exportWeeklyIncentiveReport: (params) =>
    downloadCsv(
      '/admin/referrals/reports/weekly-incentives',
      params,
      'weekly-incentive-report.csv',
    ),
  exportIncentives: (params) =>
    downloadCsv('/admin/referrals/incentives', params, 'incentives-report.csv'),
};

// --- Bulk wallet top-up -----------------------------------------------------

export const bulkTopupApi = {
  settings: () => get('/admin/bulk-topup/settings'),
  updateSettings: (body) => put('/admin/bulk-topup/settings', body),
  runManual: (body) => post('/admin/bulk-topup/run', body),
  runs: (params) => get('/admin/bulk-topup/runs', params),
  run: (id) => get(`/admin/bulk-topup/runs/${id}`),
  awards: (id, params) => get(`/admin/bulk-topup/runs/${id}/awards`, params),
  exclusions: (params) => get('/admin/bulk-topup/exclusions', params),
  addExclusion: (body) => post('/admin/bulk-topup/exclusions', body),
  removeExclusion: (userId, scope) => del(`/admin/bulk-topup/exclusions/${userId}/${scope}`),
};

// --- Manual weekly bank payouts (offline — not Cashfree) --------------------

export const manualWeeklyPayoutsApi = {
  weeks: (params) => get('/admin/manual-weekly-payouts/weeks', params),
  list: (params) => get('/admin/manual-weekly-payouts', params),
  history: (params) => get('/admin/manual-weekly-payouts/history', params),
  detail: (listenerUserId, params) =>
    get(`/admin/manual-weekly-payouts/listeners/${listenerUserId}`, params),
  update: (listenerUserId, body) =>
    patch(`/admin/manual-weekly-payouts/listeners/${listenerUserId}`, body),
  markPaid: (listenerUserId, body) =>
    post(`/admin/manual-weekly-payouts/listeners/${listenerUserId}/mark-paid`, body),
  markUnpaid: (listenerUserId, body) =>
    post(`/admin/manual-weekly-payouts/listeners/${listenerUserId}/mark-unpaid`, body),
  bulkMarkPaid: (body) => post('/admin/manual-weekly-payouts/bulk-mark-paid', body),
  export: (body) =>
    downloadBlobPost(
      '/admin/manual-weekly-payouts/export',
      body,
      `weekly-bank-payouts.${body?.format === 'xlsx' ? 'xlsx' : 'csv'}`,
    ),
};

// --- RBAC -------------------------------------------------------------------

export const rbacApi = {
  permissions: () => get('/admin/permissions'),
  sections: () => get('/admin/sections'),
  menus: () => get('/admin/menus'),
  roles: () => get('/admin/roles'),
  createRole: (body) => post('/admin/roles', body),
  updateRole: (id, body) => patch(`/admin/roles/${id}`, body),
  deleteRole: (id) => del(`/admin/roles/${id}`),
  admins: (params) => get('/admin/admins', params),
  createAdmin: (body) => post('/admin/admins', body),
  updateAdmin: (id, body) => patch(`/admin/admins/${id}`, body),
  subadmins: (params) => get('/admin/subadmins', params),
  createSubadmin: (body) => post('/admin/subadmins', body),
  updateSubadmin: (id, body) => patch(`/admin/subadmins/${id}`, body),
  subadminPhoneKeyStatus: () => get('/admin/subadmins/phone-key'),
  issueSubadminPhoneKey: () => post('/admin/subadmins/phone-key', {}),
};

// --- System configuration ---------------------------------------------------

export const configApi = {
  list: () => get('/admin/config'),
  set: (body) => put('/admin/config', body),
};

/** App version release + company WhatsApp (dedicated admin form). */
export const appSettingsApi = {
  get: () => get('/admin/app-settings'),
  update: (body) => put('/admin/app-settings', body),
};

// --- Legal documents (privacy / terms) --------------------------------------

export const legalApi = {
  list: () => get('/admin/legal'),
  get: (slug) => get(`/admin/legal/${slug}`),
  upsert: (slug, body) => put(`/admin/legal/${slug}`, body),
};

export const bannersApi = {
  list: (params) => get('/admin/banners', params),
  get: (id) => get(`/admin/banners/${id}`),
  create: (body) => post('/admin/banners', body),
  update: (id, body) => patch(`/admin/banners/${id}`, body),
  remove: (id) => del(`/admin/banners/${id}`),
  uploadImage: (formData) =>
    api
      .post('/admin/banners/upload-image', formData, {
        transformRequest: [
          (data, headers) => {
            if (headers && typeof headers === 'object') {
              delete headers['Content-Type'];
            }
            return data;
          },
        ],
      })
      .then((r) => r.data),
};

// --- Reports ----------------------------------------------------------------

export const reportsApi = {
  types: () => get('/admin/reports'),
  generate: (type, params) => get(`/admin/reports/${type}`, { ...params, format: 'json' }),
  download: (type, params) => downloadCsv(`/admin/reports/${type}`, params, `${type}-report.csv`),
};

// --- Audit log --------------------------------------------------------------

export const auditApi = {
  list: (params) => get('/admin/audit-logs', params),
};
