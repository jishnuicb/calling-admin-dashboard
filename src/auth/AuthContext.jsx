import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { tokenStore, onSessionExpired } from '../api/client';

const AuthContext = createContext(null);

/**
 * Hydrate admin from localStorage so a browser refresh keeps the current route
 * mounted (no full-app “Restoring session…” remount). `/admin/auth/me` still
 * revalidates permissions in the background.
 */
const readCachedSession = () => {
  const session = tokenStore.read();
  if (!session?.accessToken) {
    return { admin: null, status: 'anonymous' };
  }
  if (session.admin) {
    return { admin: session.admin, status: 'authenticated' };
  }
  return { admin: null, status: 'loading' };
};

/**
 * Admin session state.
 *
 * The session is persisted in localStorage so a page refresh does not force a
 * re-login, but `GET /admin/auth/me` is called on mount to re-validate it. That
 * matters because permissions can be changed server-side while a token is still
 * live - the token's embedded permission list would be stale, and `me` is the
 * authoritative answer.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const cached = readCachedSession();
  const [admin, setAdmin] = useState(cached.admin);
  const [status, setStatus] = useState(cached.status); // loading | authenticated | anonymous
  const [expiryNotice, setExpiryNotice] = useState(null);

  const persistAdmin = useCallback((nextAdmin) => {
    const session = tokenStore.read() || {};
    if (!session.accessToken) return;
    tokenStore.write({
      ...session,
      admin: nextAdmin,
      permissions: nextAdmin?.permissions || session.permissions || [],
      sections: nextAdmin?.sections || session.sections || [],
    });
  }, []);

  const clearSession = useCallback(
    (notice) => {
      tokenStore.clear();
      setAdmin(null);
      setStatus('anonymous');
      setExpiryNotice(notice || null);
      queryClient.clear();
    },
    [queryClient],
  );

  // Re-validate a persisted session on mount (soft — keep UI if cache exists).
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!tokenStore.accessToken) {
        if (!cancelled) {
          setAdmin(null);
          setStatus('anonymous');
        }
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setAdmin(me);
          setStatus('authenticated');
          persistAdmin(me);
        }
      } catch {
        // The axios interceptor already tried to refresh; reaching here means the
        // session is genuinely unusable.
        if (!cancelled) clearSession();
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession, persistAdmin]);

  // The API layer tells us when refreshing became impossible.
  useEffect(
    () =>
      onSessionExpired(() => {
        clearSession('Your session expired. Please sign in again.');
      }),
    [clearSession],
  );

  const login = useCallback(
    async (credentials) => {
      const result = await authApi.login(credentials);
      tokenStore.write({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        permissions: result.admin.permissions,
        sections: result.admin.sections,
        admin: result.admin,
      });
      setAdmin(result.admin);
      setStatus('authenticated');
      setExpiryNotice(null);
      return result.admin;
    },
    [],
  );

  const logout = useCallback(
    async (allSessions = false) => {
      try {
        await authApi.logout(allSessions);
      } catch {
        // Signing out locally must succeed even if the server call does not.
      }
      clearSession();
    },
    [clearSession],
  );

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    setAdmin(me);
    persistAdmin(me);
    return me;
  }, [persistAdmin]);

  const value = useMemo(() => {
    const permissions = new Set(admin?.permissions || []);
    const sections = new Set(admin?.sections || []);
    const isSuperAdmin = Boolean(admin?.isSuperAdmin);

    /** Super admins bypass every check, matching the backend's behaviour. */
    const can = (...required) => {
      if (isSuperAdmin) return true;
      const list = required.flat().filter(Boolean);
      if (list.length === 0) return true;
      return list.some((key) => permissions.has(key));
    };

    /** Dashboard section gate (Overview / People / …). */
    const canSection = (...required) => {
      if (isSuperAdmin) return true;
      const list = required.flat().filter(Boolean);
      if (list.length === 0) return true;
      return list.some((key) => sections.has(key));
    };

    return {
      admin,
      status,
      isAuthenticated: status === 'authenticated',
      isSuperAdmin,
      permissions,
      sections,
      expiryNotice,
      can,
      canSection,
      canAll: (...required) =>
        isSuperAdmin || required.flat().filter(Boolean).every((key) => permissions.has(key)),
      login,
      logout,
      refreshMe,
      dismissExpiryNotice: () => setExpiryNotice(null),
    };
  }, [admin, status, expiryNotice, login, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

/** Conditionally renders children when the admin holds any of `permissions`. */
export function Can({ permissions, children, fallback = null }) {
  const { can } = useAuth();
  return can(permissions) ? children : fallback;
}
