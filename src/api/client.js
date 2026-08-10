import axios from 'axios';

/**
 * The single axios instance every request goes through.
 *
 * Two things here are load-bearing and worth understanding before changing them:
 *
 * 1. **Refresh-token rotation.** The backend revokes the old refresh token on
 *    every refresh and treats a replayed one as theft, revoking *every* session
 *    for that admin. So the new refresh token must be stored, and two concurrent
 *    401s must not both attempt a refresh - the second would replay a token that
 *    the first already rotated away and log the user out of everything. Hence the
 *    single-flight `refreshPromise` below.
 *
 * 2. **Error normalisation.** The API always answers failures with
 *    `{ statusCode, message, error, details, requestId }`. Every caller gets that
 *    shape, so components never have to unwrap an axios error.
 */

const STORAGE_KEY = 'vp.admin.session';

export const tokenStore = {
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  write(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
  get accessToken() {
    return this.read()?.accessToken || null;
  },
  get refreshToken() {
    return this.read()?.refreshToken || null;
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/** Normalised error thrown to callers. `code` is the stable machine string. */
export class ApiError extends Error {
  constructor({ statusCode, message, code, details, requestId }) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field-keyed map of validation messages, for attaching errors to inputs. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, d) => {
      if (d?.field) acc[d.field] = d.message;
      return acc;
    }, {});
  }
}

const toApiError = (error) => {
  if (error.response) {
    const body = error.response.data || {};
    // Prefer Cashfree/upstream providerMessage when present so admins see the
    // exact reason (e.g. "IFSC provided is invalid") instead of a generic wrap.
    const providerMessage =
      body.details?.providerMessage ||
      (typeof body.details === 'string' ? body.details : null);
    return new ApiError({
      statusCode: body.statusCode || error.response.status,
      message:
        providerMessage ||
        body.message ||
        error.response.statusText ||
        'Request failed',
      code: body.error || 'REQUEST_FAILED',
      details: body.details,
      // Most error bodies omit requestId, but the backend always sends the
      // `x-request-id` header and lists it in Access-Control-Expose-Headers so a
      // browser can read it. That id is what locates the request in the server
      // logs, which is the whole reason we surface it to the operator.
      requestId: body.requestId || error.response.headers?.['x-request-id'],
    });
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiError({
      statusCode: 0,
      message: 'The request timed out. The server may be busy or unreachable.',
      code: 'TIMEOUT',
    });
  }
  return new ApiError({
    statusCode: 0,
    message:
      'Cannot reach the API. Check that the backend is running on the configured base URL.',
    code: 'NETWORK_ERROR',
  });
};

// --- Session expiry broadcast ---------------------------------------------
// The auth context subscribes so it can clear state and redirect to /login
// when refreshing is no longer possible.
const expiryListeners = new Set();
export const onSessionExpired = (listener) => {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
};
const broadcastExpiry = (reason) => {
  tokenStore.clear();
  expiryListeners.forEach((listener) => listener(reason));
};

api.interceptors.request.use((config) => {
  const token = tokenStore.accessToken;
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s all await the same rotation.
let refreshPromise = null;

const refreshSession = async () => {
  const refreshToken = tokenStore.refreshToken;
  if (!refreshToken) throw new Error('no refresh token');

  // Bare axios, not `api` - this must not be intercepted or it could recurse.
  const { data } = await axios.post(
    `${api.defaults.baseURL}/admin/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
  );

  const existing = tokenStore.read() || {};
  const session = {
    ...existing,
    accessToken: data.accessToken,
    // Storing the rotated token is mandatory: reusing the old one would be
    // treated as theft and revoke every session for this admin.
    refreshToken: data.refreshToken,
    permissions: data.permissions || existing.permissions,
  };
  tokenStore.write(session);
  return session;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const code = error.response?.data?.error;

    const isRefreshable =
      status === 401 &&
      !config.skipAuth &&
      !config.__isRetry &&
      // A failed login is a 401 too, but there is nothing to refresh.
      !String(config.url || '').includes('/admin/auth/login') &&
      !String(config.url || '').includes('/admin/auth/refresh');

    if (isRefreshable && tokenStore.refreshToken) {
      try {
        refreshPromise = refreshPromise || refreshSession();
        const session = await refreshPromise;
        refreshPromise = null;

        config.__isRetry = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${session.accessToken}` };
        return api.request(config);
      } catch {
        refreshPromise = null;
        broadcastExpiry('REFRESH_FAILED');
        return Promise.reject(
          new ApiError({
            statusCode: 401,
            message: 'Your session has expired. Please sign in again.',
            code: 'SESSION_EXPIRED',
          }),
        );
      }
    }

    // A 401 we cannot recover from, or an explicitly revoked session.
    if (status === 401 && !String(config.url || '').includes('/admin/auth/login')) {
      broadcastExpiry(code || 'UNAUTHORIZED');
    }

    return Promise.reject(toApiError(error));
  },
);

/** GET returning the response body. */
export const get = (url, params, config) =>
  api.get(url, { params, ...config }).then((r) => r.data);

export const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
export const put = (url, body, config) => api.put(url, body, config).then((r) => r.data);
export const patch = (url, body, config) => api.patch(url, body, config).then((r) => r.data);
export const del = (url, config) => api.delete(url, config).then((r) => r.data);

/**
 * Downloads a CSV export. The report endpoints return a file rather than JSON,
 * and they still need the Authorization header - so this cannot be a plain
 * anchor href.
 */
export const downloadCsv = async (url, params, filename) => {
  const response = await api.get(url, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });

  const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'report.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};
