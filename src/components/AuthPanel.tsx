import React, { useEffect, useState } from "react";
import { X, UserRound, Heart, Link2 } from "lucide-react";
import { useAuth, getStoredUser, getStoredToken, clearAuth, AuthUser, AuthError } from "../hooks/useAuth";
import { useDialog } from "../hooks/useDialog";

export const AuthPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dialogRef = useDialog(true, onClose);
  const { register, login, me, createPairCode, confirmPair, logout, unpair, changePassword } = useAuth();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [pairCode, setPairCode] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [partnerMsg, setPartnerMsg] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    void me(token).then(setUser).catch((error) => {
      if (error instanceof AuthError && error.status === 401) {
        clearAuth();
        setUser(null);
        setError("Your account session expired. Sign in again.");
      } else setError(error.message || "Could not check your account. Please retry.");
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await register(nickname.trim(), password);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await login(nickname.trim(), password);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleLogout = async () => {
    const token = getStoredToken();
    if (token) await logout(token).catch(() => clearAuth());
    setUser(null);
    setPairCode("");
    setPartnerMsg("");
  };

  const handleUnpair = async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      setUser(await unpair(token));
      setPartnerMsg("Partner link removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink partner.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;
    try {
      await changePassword(token, oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setPartnerMsg("Password updated. Other sessions were signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    }
  };

  const handleCreatePairCode = async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const code = await createPairCode(token);
      setPairCode(code);
    } catch (err: any) {
      setError(err.message || "Could not create pair code");
    }
  };

  const handleConfirmPair = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return;
    try {
      const partner = await confirmPair(token, partnerInput.trim().toUpperCase());
      setPartnerMsg(`You're now paired with ${partner.nickname} ❤️`);
      setUser(getStoredUser());
      setPartnerInput("");
    } catch (err: any) {
      setPartnerMsg(err.message || "Invalid pair code");
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 flex items-center justify-center p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Account" className="auth-dialog w-full max-w-md max-h-[90vh] overflow-y-auto bg-canvas border border-hairline rounded-2xl shadow-premium p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <UserRound className="w-4 h-4 text-ink" />
            <span className="text-xs font-black uppercase tracking-widest font-mono">Account</span>
          </div>
          <button aria-label="Close account" onClick={onClose} className="p-1.5 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer">
            <X className="w-4 h-4 text-ink" />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-block-coral border border-ink flex items-center justify-center">
                <Heart className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-sm font-black text-ink">{user.nickname}</p>
                <p className="text-[10px] text-zinc-500 font-bold">
                  {user.partner_id ? "Paired ❤️" : "Not paired yet"}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-hairline pt-4">
              <span className="text-[10px] font-black uppercase tracking-widest font-mono text-zinc-500">Partner pairing</span>
              {user.partner_id ? (
                <p className="text-[11px] text-zinc-500">This account is linked to a partner.</p>
              ) : pairCode ? (
                <p className="text-xs font-bold text-ink">Your pair code: <span className="font-mono text-amber-500">{pairCode}</span><span className="block mt-1 text-zinc-500 font-normal">Expires in 10 minutes. Share it privately with your partner.</span></p>
              ) : (
                <button
                  onClick={handleCreatePairCode}
                  className="w-full py-2 rounded-full bg-ink text-canvas text-[11px] font-black cursor-pointer"
                >
                  Generate pair code
                </button>
              )}
              {!user.partner_id && <p className="text-[10px] text-zinc-500">Pair codes expire after 10 minutes.</p>}
              {!user.partner_id && <form onSubmit={handleConfirmPair} className="flex items-center gap-2">
                <input
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  placeholder="Enter partner's code"
                  className="flex-1 px-3 py-2 bg-canvas border border-hairline rounded text-[11px] font-bold focus:outline-none"
                />
                <button type="submit" className="p-2 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer">
                  <Link2 className="w-4 h-4 text-ink" />
                </button>
              </form>}
              {partnerMsg && <p className="text-[10px] font-bold text-emerald-500">{partnerMsg}</p>}
              {user.partner_id && <button type="button" onClick={handleUnpair} className="w-full py-2 rounded-full border border-hairline text-[11px] font-bold text-ink">Unlink partner</button>}
            </div>

            <form onSubmit={handleChangePassword} className="space-y-2 border-t border-hairline pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest font-mono text-zinc-500">Change password</p>
              <input type="password" aria-label="Current password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" className="w-full px-3 py-2 bg-canvas border border-hairline rounded text-[11px]" />
              <input type="password" aria-label="New password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="w-full px-3 py-2 bg-canvas border border-hairline rounded text-[11px]" />
              <button type="submit" className="w-full py-2 rounded-full border border-hairline text-[11px] font-bold text-ink">Update password</button>
            </form>

            {error && <p role="alert" className="text-[10px] font-bold text-rose-500">{error}</p>}

            <button onClick={handleLogout} className="w-full py-2 rounded-full border border-hairline text-[11px] font-bold text-ink hover:bg-surface-soft cursor-pointer">
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="account-nickname" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-1 font-mono">Nickname</label>
                <input
                  id="account-nickname"
                  autoComplete="username"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your nickname"
                  className="w-full px-3 py-2.5 bg-canvas border border-hairline rounded text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="account-password" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-1 font-mono">Password (min 8 chars)</label>
                <input
                  id="account-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-canvas border border-hairline rounded text-xs font-bold focus:outline-none"
                />
              </div>
              {error && <p role="alert" className="text-[10px] font-bold text-rose-500">{error}</p>}
              <button type="submit" className="w-full py-2.5 rounded-full bg-ink text-canvas text-[11px] font-black cursor-pointer">
                Sign in
              </button>
              <button
                type="button"
                onClick={handleRegister}
                className="w-full py-2.5 rounded-full border border-hairline text-[11px] font-bold text-ink hover:bg-surface-soft cursor-pointer"
              >
                Create account
              </button>
            </form>
            <p className="text-[10px] text-zinc-500 font-bold text-center">
              Guest mode stays available — you can keep joining rooms without an account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
