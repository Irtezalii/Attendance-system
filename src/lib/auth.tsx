import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeResponse } from "../../shared/api";
import { ApiRequestError, apiRequest, SESSION_EXPIRED_EVENT } from "./api";

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  /** True when the server ended the session (expired or revoked) while the app was open. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<MeResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    apiRequest<MeResponse>("/auth/me")
      .then(setMe)
      .catch((error) => {
        if (!(error instanceof ApiRequestError && error.status === 401)) console.error(error);
      })
      .finally(() => setLoading(false));

    const onExpired = () => {
      setMe(null);
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiRequest("/auth/login", { body: { email, password } });
    const current = await apiRequest<MeResponse>("/auth/me");
    setMe(current);
    setSessionExpired(false);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setMe(null);
      setSessionExpired(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, sessionExpired, login, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
