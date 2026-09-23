// Account requests share a timeout and preserve valid sessions during outages.
const API = () => (import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com").replace(/\/$/, "");
export interface AuthUser { id: number; nickname: string; partner_id: number | null; }
const TOKEN_KEY = "cinepair_token";
const USER_KEY = "cinepair_user";
export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = (): AuthUser | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
};
export const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
const persist = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

async function request(path: string, method = "GET", token?: string, body?: object) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${API()}${path}`, {
      method, signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AuthError(typeof data.detail === "string" ? data.detail : "The account service is temporarily unavailable. Please retry.", res.status);
    return data;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Could not reach the account service. Check your connection and retry.", 0);
  } finally { window.clearTimeout(timeout); }
}

export const useAuth = () => {
  const authenticate = async (path: string, nickname: string, password: string) => {
    const data = await request(path, "POST", undefined, { nickname, password });
    persist(data.token, data.user);
    return data;
  };
  const me = async (token: string): Promise<AuthUser> => {
    const data = await request("/auth/me", "GET", token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };
  return {
    register: (nickname: string, password: string) => authenticate("/auth/register", nickname, password),
    login: (nickname: string, password: string) => authenticate("/auth/login", nickname, password),
    me,
    createPairCode: async (token: string): Promise<string> => (await request("/auth/pair", "POST", token)).pair_code,
    confirmPair: async (token: string, code: string): Promise<AuthUser> => {
      const data = await request("/auth/pair/confirm", "POST", token, { pair_code: code });
      await me(token);
      return data.partner;
    },
    logout: async (token: string) => {
      try { await request("/auth/logout", "POST", token); } finally { clearAuth(); }
    },
    unpair: async (token: string): Promise<AuthUser> => {
      const data = await request("/auth/unpair", "POST", token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    },
    changePassword: (token: string, oldPassword: string, newPassword: string) => request("/auth/password", "POST", token, { old_password: oldPassword, new_password: newPassword }),
  };
};
