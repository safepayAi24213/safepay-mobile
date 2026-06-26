/**
 * Simple in-memory auth store. Holds the JWT + the user returned from the
 * backend so screens after login can call the API.
 *
 * In-memory by design — refreshing Expo Go signs you out, which is fine for
 * demos. Add AsyncStorage when we want persistence.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { TokenDTO, UserDTO } from './api';
import { clearSession, saveSession } from './session-store';

type AuthState = {
  token: string | null;
  user: UserDTO | null;
  setSession: (token: TokenDTO) => void;
  /** Restore an already-persisted session (e.g. after a Face ID unlock). */
  restore: (token: string, user: UserDTO) => void;
  /** Merge fields into the current user (e.g. after updating the avatar). */
  updateUser: (patch: Partial<UserDTO>) => void;
  signOut: () => void;
};

const AuthCtx = createContext<AuthState>({
  token: null,
  user: null,
  setSession: () => {},
  restore: () => {},
  updateUser: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);

  const setSession = useCallback((t: TokenDTO) => {
    setToken(t.access_token);
    setUser(t.user);
    // Persist securely so Face ID can restore it later.
    void saveSession(t.access_token, t.user);
  }, []);

  const restore = useCallback((tok: string, u: UserDTO) => {
    setToken(tok);
    setUser(u);
  }, []);

  const updateUser = useCallback((patch: Partial<UserDTO>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void saveSession(token ?? '', next); // keep the stored copy in sync
      return next;
    });
  }, [token]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    void clearSession();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, setSession, restore, updateUser, signOut }),
    [token, user, setSession, restore, updateUser, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

/**
 * Hook for screens that strictly need a token. Throws if called before login.
 * Use this to fail loudly when a screen forgot to gate itself behind auth.
 */
export function useRequireToken(): string {
  const { token } = useAuth();
  if (!token) {
    throw new Error('useRequireToken called without an active session');
  }
  return token;
}
