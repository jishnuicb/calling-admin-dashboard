/**
 * React Query cache keys.
 *
 * Centralised so invalidation after a mutation targets the right subtree without
 * guessing at key shapes. Convention: `[domain, scope, params]` - invalidating
 * `['users']` clears every user list and detail below it.
 */
export const qk = {
  me: ['me'],
  dashboard: (params) => ['dashboard', params],

  users: (params) => ['users', 'list', params],
  user: (id) => ['users', 'detail', id],

  listeners: (params) => ['listeners', 'list', params],
  listener: (id) => ['listeners', 'detail', id],

  otpSummary: ['otp', 'summary'],
  otpLocks: (params) => ['otp', 'locks', params],

  languages: (params) => ['languages', params],

  wallet: (userId) => ['wallet', userId],
  walletHistory: (userId, params) => ['wallet', userId, 'history', params],

  payments: (params) => ['payments', 'list', params],
  payment: (id) => ['payments', 'detail', id],

  packages: ['packages'],

  earnings: (params) => ['earnings', 'list', params],
  earningsSummary: (params) => ['earnings', 'summary', params],
  payouts: (params) => ['payouts', 'list', params],
  payout: (id) => ['payouts', 'detail', id],

  calls: (params) => ['calls', 'list', params],
  call: (id) => ['calls', 'detail', id],

  moderation: (params) => ['moderation', 'list', params],
  report: (id) => ['moderation', 'detail', id],

  templates: ['notifications', 'templates'],
  notificationHistory: (params) => ['notifications', 'history', params],

  weeklyRuns: (params) => ['bonuses', 'weekly', params],
  weeklyAwards: (id, params) => ['bonuses', 'weekly', id, 'awards', params],
  promotions: (params) => ['bonuses', 'promotions', params],

  permissions: ['rbac', 'permissions'],
  roles: ['rbac', 'roles'],
  admins: (params) => ['rbac', 'admins', params],

  config: ['config'],

  legalList: ['legal', 'list'],
  legal: (slug) => ['legal', 'detail', slug],

  reportTypes: ['reports', 'types'],
  reportData: (type, params) => ['reports', type, params],

  audit: (params) => ['audit', params],
};
