// Optional multi-user auth gate.
// Wrap <App /> in <AuthGate> in main.tsx to enable it.
// Without the wrapper, the app works with no authentication.
//
// Credentials are stored hashed (SHA-256 + salt) in localStorage.
// This is UI-level protection, not server-side security.
import { useState, useEffect, useMemo, useCallback, useId } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  salt: string;
  hash: string;
  createdAt: number;
}

interface AuthSession {
  username: string;
  role: 'admin' | 'user';
  at: number;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const USERS_KEY   = 'genealogor.auth.users.v1';
const SESSION_KEY = 'genealogor.auth.session.v1';

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}::${password}`);
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AuthUser[]) : [];
  } catch { return []; }
}
function saveUsers(users: AuthUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function loadSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch { return null; }
}
function saveSession(session: AuthSession, remember: boolean) {
  const json = JSON.stringify(session);
  if (remember) { localStorage.setItem(SESSION_KEY, json); sessionStorage.removeItem(SESSION_KEY); }
  else { sessionStorage.setItem(SESSION_KEY, json); localStorage.removeItem(SESSION_KEY); }
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

// ── AuthGate ──────────────────────────────────────────────────────────────────

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [users, setUsers]         = useState<AuthUser[]>(() => loadUsers());
  const [session, setSession]     = useState<AuthSession | null>(() => loadSession());
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => { saveUsers(users); }, [users]);

  const currentUser = useMemo(
    () => session ? (users.find((u) => u.username === session.username) ?? null) : null,
    [session, users],
  );

  useEffect(() => {
    if (session && !currentUser) { clearSession(); setSession(null); }
  }, [session, currentUser]);

  const handleLogin = useCallback((user: AuthUser, remember: boolean) => {
    const s: AuthSession = { username: user.username, role: user.role, at: Date.now() };
    saveSession(s, remember);
    setSession(s);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setShowAdmin(false);
  }, []);

  if (users.length === 0) {
    return <FirstRunSetup onCreate={(admin) => setUsers([admin])} />;
  }
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  return (
    <>
      {children}
      {showAdmin && currentUser.role === 'admin' && (
        <AdminPanel
          users={users}
          currentUser={currentUser}
          setUsers={setUsers}
          onClose={() => setShowAdmin(false)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

// ── Material-style floating-label text field ──────────────────────────────────

interface TextFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  error?: string;
  trailing?: React.ReactNode;
}

function TextField({ label, type = 'text', value, onChange, hint, autoFocus, autoComplete, error, trailing }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const float = focused || value.length > 0;
  const id = useId();
  const borderColor = error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border-strong)';

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height: 56, background: 'var(--surface)', border: `1px solid ${borderColor}`, borderRadius: 12, transition: 'border-color 0.15s', boxShadow: focused ? `0 0 0 3px color-mix(in oklch, ${borderColor} 18%, transparent)` : 'none' }}>
        <label htmlFor={id} className="absolute pointer-events-none transition-all"
          style={{ left: 14, top: float ? 6 : 18, fontSize: float ? 11 : 15, fontWeight: float ? 500 : 400, color: error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--ink-faint)', transition: 'all 0.15s' }}>
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="absolute inset-0 px-3.5 pt-5 pb-1 w-full bg-transparent outline-none"
          style={{ color: 'var(--ink)', fontSize: 15, paddingRight: trailing ? 48 : 14 }}
        />
        {trailing && <div className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {hint && !error && <div className="px-3.5 mt-1 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>{hint}</div>}
      {error && <div className="px-3.5 mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
}

function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [reveal, setReveal] = useState(false);
  return (
    <TextField {...props} type={reveal ? 'text' : 'password'}
      trailing={
        <button type="button" onClick={() => setReveal((v) => !v)} className="size-11 grid place-items-center rounded-full" style={{ color: 'var(--ink-faint)' }} aria-label={reveal ? 'Masquer' : 'Afficher'}>
          {reveal
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      }
    />
  );
}

function FilledButton({ children, onClick, type = 'button', disabled, loading }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  disabled?: boolean; loading?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className="w-full font-medium tracking-tight transition-opacity disabled:opacity-50 active:opacity-80"
      style={{ height: 52, borderRadius: 28, background: 'var(--ink)', color: 'var(--bg)', fontSize: 15 }}>
      {loading ? '…' : children}
    </button>
  );
}

function OutlinedButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full font-medium tracking-tight transition-opacity active:opacity-80"
      style={{ height: 48, borderRadius: 24, background: 'transparent', border: `1px solid ${danger ? 'var(--danger)' : 'var(--border-strong)'}`, color: danger ? 'var(--danger)' : 'var(--ink)', fontSize: 14.5 }}>
      {children}
    </button>
  );
}

function AuthScreen({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)', paddingTop: 'max(24px, env(safe-area-inset-top))', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
      <div className="flex-1 flex flex-col px-6 pt-8 pb-6 max-w-[520px] mx-auto w-full">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="rounded-2xl flex items-center justify-center mb-4" style={{ width: 64, height: 64, background: 'var(--ink)', color: 'var(--bg)' }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="14" r="2.5"/><circle cx="19" cy="14" r="2.5"/>
              <path d="M12 7.5v3M12 10.5L5.8 12.2M12 10.5l6.2 1.7"/>
            </svg>
          </div>
          <div className="text-[18px] font-semibold tracking-tight">Genealogor</div>
          <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>Visualiseur GEDCOM</div>
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight mb-2">{title}</h1>
        {subtitle && <p className="text-[14px] leading-relaxed mb-7" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>}
        <div className="flex-1 flex flex-col">{children}</div>
        {footer && <div className="mt-6 pt-5 text-[12px] leading-relaxed" style={{ borderTop: '1px solid var(--border)', color: 'var(--ink-faint)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── FirstRunSetup ─────────────────────────────────────────────────────────────

function FirstRunSetup({ onCreate }: { onCreate: (admin: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = normalizeUsername(username);
    if (!u)                        return setError("Nom d'utilisateur requis.");
    if (password.length < 6)       return setError('Mot de passe : 6 caractères minimum.');
    if (password !== confirm)      return setError('Les mots de passe ne correspondent pas.');
    setBusy(true);
    try {
      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      onCreate({ username: u, displayName: username.trim(), role: 'admin', salt, hash, createdAt: Date.now() });
    } catch { setError('Erreur lors de la création du compte.'); setBusy(false); }
  };

  return (
    <AuthScreen title="Créer l'admin" subtitle="Première utilisation. Ce compte pourra ensuite ajouter d'autres utilisateurs."
      footer="Mots de passe stockés hachés dans ce navigateur. Cette protection limite l'accès à l'interface uniquement.">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <TextField label="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        <PasswordField label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="6 caractères minimum" />
        <PasswordField label="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        {error && <div className="text-[13px] px-4 py-3 rounded-lg" style={{ background: 'color-mix(in oklch, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>{error}</div>}
        <div className="pt-2"><FilledButton type="submit" loading={busy}>Créer le compte</FilledButton></div>
      </form>
    </AuthScreen>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────

function LoginScreen({ users, onLogin }: { users: AuthUser[]; onLogin: (user: AuthUser, remember: boolean) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = normalizeUsername(username);
    const user = users.find((x) => x.username === u);
    if (!user) { setError('Identifiants incorrects.'); return; }
    setBusy(true);
    try {
      const h = await hashPassword(password, user.salt);
      if (h !== user.hash) { setError('Identifiants incorrects.'); setBusy(false); return; }
      onLogin(user, remember);
    } catch { setError("Erreur d'authentification."); setBusy(false); }
  };

  return (
    <AuthScreen title="Connexion" subtitle="Accès réservé aux utilisateurs déclarés par l'administrateur."
      footer="Mot de passe oublié ? Contactez l'administrateur.">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <TextField label="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        <PasswordField label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <label className="flex items-center gap-3 py-2 text-[14px] select-none" style={{ color: 'var(--ink-muted)' }}>
          <span onClick={() => setRemember((v) => !v)} className="relative inline-block shrink-0 cursor-pointer"
            style={{ width: 44, height: 26, borderRadius: 13, background: remember ? 'var(--accent)' : 'var(--border-strong)', transition: 'background 0.15s' }}>
            <span style={{ position: 'absolute', top: 3, left: remember ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: 'var(--bg)', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </span>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="sr-only" />
          Rester connecté sur ce téléphone
        </label>
        {error && <div className="text-[13px] px-4 py-3 rounded-lg" style={{ background: 'color-mix(in oklch, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>{error}</div>}
        <div className="pt-2"><FilledButton type="submit" loading={busy}>Se connecter</FilledButton></div>
      </form>
    </AuthScreen>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────────────

function AdminPanel({ users, currentUser, setUsers, onClose, onLogout }: {
  users: AuthUser[]; currentUser: AuthUser;
  setUsers: React.Dispatch<React.SetStateAction<AuthUser[]>>;
  onClose: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab]           = useState<'list' | 'new'>('list');
  const [newUsername, setNewU]  = useState('');
  const [newDisplay, setNewD]   = useState('');
  const [newPassword, setNewP]  = useState('');
  const [newRole, setNewRole]   = useState<'user' | 'admin'>('user');
  const [msg, setMsg]           = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [actionFor, setActionFor] = useState<AuthUser | null>(null);

  const note = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 2800);
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = normalizeUsername(newUsername);
    if (!u) return note('err', "Nom d'utilisateur requis.");
    if (users.some((x) => x.username === u)) return note('err', 'Ce nom existe déjà.');
    if (newPassword.length < 6) return note('err', 'Mot de passe : 6 caractères minimum.');
    const salt = randomSalt();
    const hash = await hashPassword(newPassword, salt);
    setUsers((prev) => [...prev, { username: u, displayName: newDisplay.trim() || newUsername.trim(), role: newRole, salt, hash, createdAt: Date.now() }]);
    setNewU(''); setNewD(''); setNewP(''); setNewRole('user');
    note('ok', `Utilisateur « ${u} » créé.`);
    setTab('list');
  };

  const resetPassword = async (user: AuthUser) => {
    const pw = prompt(`Nouveau mot de passe pour « ${user.username} » :`);
    if (pw == null) return;
    if (pw.length < 6) return note('err', 'Mot de passe : 6 caractères minimum.');
    const salt = randomSalt();
    const hash = await hashPassword(pw, salt);
    setUsers((prev) => prev.map((u) => u.username === user.username ? { ...u, salt, hash } : u));
    note('ok', `Mot de passe réinitialisé pour « ${user.username} ».`);
    setActionFor(null);
  };

  const removeUser = (user: AuthUser) => {
    if (user.username === currentUser.username) return note('err', 'Vous ne pouvez pas vous supprimer.');
    if (user.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) return note('err', 'Il doit rester au moins un administrateur.');
    if (!confirm(`Supprimer définitivement « ${user.username} » ?`)) return;
    setUsers((prev) => prev.filter((u) => u.username !== user.username));
    setActionFor(null);
  };

  const toggleRole = (user: AuthUser) => {
    if (user.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) return note('err', 'Il doit rester au moins un administrateur.');
    setUsers((prev) => prev.map((u) => u.username === user.username ? { ...u, role: u.role === 'admin' ? 'user' : 'admin' } : u));
    setActionFor(null);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-1 px-1.5" style={{ height: 56, borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} className="size-12 grid place-items-center rounded-full" style={{ color: 'var(--ink)' }} aria-label="Fermer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="flex-1 px-1">
          <div className="text-[17px] font-semibold tracking-tight leading-tight">Utilisateurs</div>
          <div className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>{users.length} {users.length > 1 ? 'comptes' : 'compte'}</div>
        </div>
        <button onClick={onLogout} className="ml-auto mr-2 h-9 px-3 rounded-full text-[13px] font-medium active:opacity-70"
          style={{ border: '1px solid var(--border)', color: 'var(--ink-muted)' }}>
          Déconnexion
        </button>
      </div>
      <div className="px-4 pt-3 pb-1">
        <div className="flex p-1 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(['list', 'new'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 font-medium transition-colors" style={{ height: 40, borderRadius: 20, fontSize: 13.5, background: tab === t ? 'var(--ink)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--ink-muted)' }}>
              {t === 'list' ? 'Comptes' : 'Nouveau'}
            </button>
          ))}
        </div>
      </div>
      {msg && (
        <div className="mx-4 mt-3">
          <div className="text-[13px] px-4 py-3 rounded-xl" style={{ background: msg.kind === 'ok' ? 'color-mix(in oklch, var(--accent) 14%, transparent)' : 'color-mix(in oklch, var(--danger) 14%, transparent)', color: msg.kind === 'ok' ? 'var(--accent)' : 'var(--danger)' }}>{msg.text}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'list' && (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <button key={u.username} onClick={() => setActionFor(u)} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left active:opacity-80" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ width: 44, height: 44, background: 'var(--ink)', color: 'var(--bg)' }}>
                  {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-medium leading-tight truncate">{u.displayName || u.username}</div>
                    {u.username === currentUser.username && <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>vous</span>}
                  </div>
                  <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>@{u.username} · {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {tab === 'new' && (
          <form onSubmit={(e) => void addUser(e)} className="flex flex-col gap-4">
            <TextField label="Nom d'utilisateur" value={newUsername} onChange={(e) => setNewU(e.target.value)} autoComplete="off" />
            <TextField label="Nom affiché (facultatif)" value={newDisplay} onChange={(e) => setNewD(e.target.value)} autoComplete="off" />
            <TextField label="Mot de passe" value={newPassword} onChange={(e) => setNewP(e.target.value)} hint="6 caractères minimum" autoComplete="off" />
            <div>
              <div className="text-[12px] font-medium mb-2 px-1" style={{ color: 'var(--ink-muted)' }}>Rôle</div>
              <div className="flex p-1 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {(['user', 'admin'] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setNewRole(r)} className="flex-1 font-medium"
                    style={{ height: 40, borderRadius: 20, fontSize: 13.5, background: newRole === r ? 'var(--ink)' : 'transparent', color: newRole === r ? 'var(--bg)' : 'var(--ink-muted)' }}>
                    {r === 'user' ? 'Utilisateur' : 'Administrateur'}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3"><FilledButton type="submit">Ajouter l'utilisateur</FilledButton></div>
          </form>
        )}
      </div>
      {actionFor && (
        <ActionSheet user={actionFor} currentUser={currentUser} onClose={() => setActionFor(null)}
          onResetPassword={() => void resetPassword(actionFor)}
          onToggleRole={() => toggleRole(actionFor)}
          onRemove={() => removeUser(actionFor)} />
      )}
    </div>
  );
}

function ActionSheet({ user, currentUser, onClose, onResetPassword, onToggleRole, onRemove }: {
  user: AuthUser; currentUser: AuthUser;
  onClose: () => void; onResetPassword: () => void; onToggleRole: () => void; onRemove: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-end" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full" style={{ background: 'var(--bg)', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', animation: 'sheetUp 0.25s ease-out' }}>
        <div className="flex justify-center pt-3 pb-2"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} /></div>
        <div className="px-5 pb-2">
          <div className="text-[16px] font-semibold leading-tight">{user.displayName || user.username}</div>
          <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>@{user.username} · {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</div>
        </div>
        <div className="px-2 py-2 flex flex-col">
          <ActionItem label="Réinitialiser le mot de passe" onClick={onResetPassword} />
          <ActionItem label={user.role === 'admin' ? 'Rétrograder en utilisateur' : 'Promouvoir administrateur'} onClick={onToggleRole} />
          <ActionItem label="Supprimer le compte" onClick={onRemove} danger disabled={user.username === currentUser.username} />
        </div>
        <div className="px-4 pt-2"><OutlinedButton onClick={onClose}>Annuler</OutlinedButton></div>
      </div>
    </div>
  );
}

function ActionItem({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left active:opacity-80 disabled:opacity-40"
      style={{ color: danger ? 'var(--danger)' : 'var(--ink)' }}>
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}
