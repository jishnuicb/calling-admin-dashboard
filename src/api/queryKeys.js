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
  listenerOnlineTime: (params) => ['listeners', 'online-time', params],
  listenerOnlineTimeDetail: (id, params) => ['listeners', 'online-time', 'detail', id, params],
  listenerCallingTime: (params) => ['listeners', 'calling-time', params],
  listenerCallingTimeDetail: (id, params) => ['listeners', 'calling-time', 'detail', id, params],

  otpSummary: ['otp', 'summary'],
  otpLocks: (params) => ['otp', 'locks', params],
  otpIpLogs: (params) => ['otp', 'ip-logs', params],
  otpAllowedCountries: ['otp', 'allowed-countries'],

  crashes: (params) => ['crashes', params],

  languages: (params) => ['languages', params],

  avatars: (params) => ['avatars', params],

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

  blocks: (params) => ['blocks', 'list', params],

  accountDeletion: (params) => ['accountDeletion', 'list', params],

  templates: ['notifications', 'templates'],
  notificationHistory: (params) => ['notifications', 'history', params],

  weeklyRuns: (params) => ['bonuses', 'weekly', params],
  weeklyAwards: (id, params) => ['bonuses', 'weekly', id, 'awards', params],
  weeklySettings: ['bonuses', 'weekly', 'settings'],

  bulkTopupSettings: ['bulk-topup', 'settings'],
  bulkTopupRuns: (params) => ['bulk-topup', 'runs', params],
  bulkTopupAwards: (id, params) => ['bulk-topup', 'awards', id, params],
  bulkTopupExclusions: (params) => ['bulk-topup', 'exclusions', params],

  manualWeeklyWeeks: (params) => ['manual-weekly-payouts', 'weeks', params],
  manualWeeklyList: (params) => ['manual-weekly-payouts', 'list', params],
  manualWeeklyHistory: (params) => ['manual-weekly-payouts', 'history', params],
  manualWeeklyDetail: (listenerUserId, weekStart) => [
    'manual-weekly-payouts',
    'detail',
    listenerUserId,
    weekStart,
  ],

  permissions: ['rbac', 'permissions'],
  sections: ['rbac', 'sections'],
  roles: ['rbac', 'roles'],
  admins: (params) => ['rbac', 'admins', params],

  config: ['config'],
  appSettings: ['config', 'app-settings'],
  ipBlocks: (params) => ['security', 'ip-blocks', params],

  legalList: ['legal', 'list'],
  legal: (slug) => ['legal', 'detail', slug],

  banners: (params) => ['banners', params],

  reportTypes: ['reports', 'types'],
  reportData: (type, params) => ['reports', type, params],

  audit: (params) => ['audit', params],
};
