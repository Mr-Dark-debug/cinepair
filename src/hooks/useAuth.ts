// Minimal auth client for the CinePair account endpoints (backend already
// implemented + tested). Token/user are persisted in localStorage.

const API = () =>
  (import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com").replace(/\/$/, "");

export interface AuthUser {
  id: number;
  nickname: string;
  partner_id: number | null;
}

const TOKEN_KEY = "cinepair_token";
const USER_KEY = "cinepair_user";

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const persist = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const useAuth = () => {
  const register = async (nickname: string, password: string) => {
    const res = await fetch(`${API()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    persist(data.token, data.user);
    return data;
  };

  const login = async (nickname: string, password: string) => {
    const res = await fetch(`${API()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    persist(data.token, data.user);
    return data;
  };

  const me = async (token: string) => {
    const res = await fetch(`${API()}/auth/me`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Invalid session");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user as AuthUser;
  };

  const createPairCode = async (token: string) => {
    const res = await fetch(`${API()}/auth/pair`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Could not create pair code");
    return data.pair_code as string;
  };

  const confirmPair = async (token: string, code: string) => {
    const res = await fetch(`${API()}/auth/pair/confirm`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ pair_code: code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Invalid pair code");
    const me = await getStoredUser();
    if (me) {
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({ ...me, partner_id: data.partner.id })
      );
    }
    return data.partner as AuthUser;
  };

  return { register, login, me, createPairCode, confirmPair };
};
