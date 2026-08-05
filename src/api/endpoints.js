import { api, get, post, put, patch, del, downloadCsv } from './client';

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
  setBlocked: (id, body) => post(`/admin/users/${id}/block`, body),
};

// --- Listener applications --------------------------------------------------

export const listenersApi = {
  list: (params) => get('/admin/listeners/applications', params),
  get: (id) => get(`/admin/listeners/applications/${id}`),
  approve: (id, body) => post(`/admin/listeners/applications/${id}/approve`, body),
  reject: (id, body) => post(`/admin/listeners/applications/${id}/reject`, body),
  suspend: (id, body) => post(`/admin/listeners/applications/${id}/suspend`, body),
  reactivate: (id, body) => post(`/admin/listeners/applications/${id}/reactivate`, body),
  addNotes: (id, body) => post(`/admin/listeners/applications/${id}/notes`, body),
  syncBeneficiary: (id) => post(`/admin/listeners/applications/${id}/beneficiary/sync`),
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
};

// --- Language master --------------------------------------------------------

export const languagesApi = {
  list: (params) => get('/admin/languages', params),
  create: (body) => post('/admin/languages', body),
  update: (id, body) => patch(`/admin/languages/${id}`, body),
  // Returns 409 LANGUAGE_IN_USE while any listener references the language.
  remove: (id) => del(`/admin/languages/${id}`),
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

// --- Token packages ---------------------------------------------------------

export const packagesApi = {
  list: () => get('/admin/packages'),
  create: (body) => post('/admin/packages', body),
  update: (id, body) => patch(`/admin/packages/${id}`, body),
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

// --- Notifications ----------------------------------------------------------

export const notificationsApi = {
  templates: () => get('/admin/notifications/templates'),
  upsertTemplate: (key, body) => put(`/admin/notifications/templates/${key}`, body),
  send: (body) => post('/admin/notifications/send', body),
  history: (params) => get('/admin/notifications/history', params),
};

// --- Bonuses ----------------------------------------------------------------

export const bonusesApi = {
  weeklyRuns: (params) => get('/admin/bonuses/weekly/runs', params),
  weeklyAwards: (id, params) => get(`/admin/bonuses/weekly/runs/${id}/awards`, params),
  weeklySettings: () => get('/admin/bonuses/weekly/settings'),
  updateWeeklySettings: (body) => put('/admin/bonuses/weekly/settings', body),
  runWeekly: (body) => post('/admin/bonuses/weekly/run', body),
};

// --- RBAC -------------------------------------------------------------------

export const rbacApi = {
  permissions: () => get('/admin/permissions'),
  roles: () => get('/admin/roles'),
  createRole: (body) => post('/admin/roles', body),
  updateRole: (id, body) => patch(`/admin/roles/${id}`, body),
  deleteRole: (id) => del(`/admin/roles/${id}`),
  admins: (params) => get('/admin/admins', params),
  createAdmin: (body) => post('/admin/admins', body),
  updateAdmin: (id, body) => patch(`/admin/admins/${id}`, body),
};

// --- System configuration ---------------------------------------------------

export const configApi = {
  list: () => get('/admin/config'),
  set: (body) => put('/admin/config', body),
};

// --- Legal documents (privacy / terms) --------------------------------------

export const legalApi = {
  list: () => get('/admin/legal'),
  get: (slug) => get(`/admin/legal/${slug}`),
  upsert: (slug, body) => put(`/admin/legal/${slug}`, body),
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
