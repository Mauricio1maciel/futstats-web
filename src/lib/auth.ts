import { fetchWithTimeout, parseBody } from './http';
import { storageGet, storageRemove, storageSet } from './storage';

const DEVICE_ID_KEY = 'device_id';
const GUEST_TOKEN_KEY = 'jwt_token';
const ADMIN_TOKEN_KEY = 'admin_jwt_token';

// =========================================================================
// Convidado: um device_id por navegador e um token de 30 dias
// =========================================================================

function randomUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Safari antigo (< 15.4) não tem randomUUID
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateDeviceId() {
  let deviceId = storageGet(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = randomUUID();
    storageSet(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export const getGuestToken = () => storageGet(GUEST_TOKEN_KEY);

export const clearGuestToken = () => storageRemove(GUEST_TOKEN_KEY);

// Várias telas pedem dados ao mesmo tempo: todas esperam a MESMA chamada a /auth/guest
let guestAuthInFlight: Promise<string | null> | null = null;

export function authenticateGuest(baseUrl: string) {
  if (!guestAuthInFlight) {
    guestAuthInFlight = requestGuestToken(baseUrl).finally(() => {
      guestAuthInFlight = null;
    });
  }
  return guestAuthInFlight;
}

async function requestGuestToken(baseUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getOrCreateDeviceId() }),
    });
    if (!response.ok) return null;
    const data = (await parseBody(response)) as { token?: string } | null;
    if (!data?.token) return null;
    storageSet(GUEST_TOKEN_KEY, data.token);
    return data.token;
  } catch {
    // A falha aparece no aviso de rede da requisição que pediu o token
    return null;
  }
}

// =========================================================================
// Admin (e-mail + senha). Só o token fica guardado, nunca a senha
// =========================================================================

const adminListeners = new Set<(isAdmin: boolean) => void>();
let storageListenerAttached = false;

const emitAdmin = () => {
  const value = !!getAdminToken();
  adminListeners.forEach(listener => listener(value));
};

export const getAdminToken = () => storageGet(ADMIN_TOKEN_KEY);

export const isAdminLoggedIn = () => !!getAdminToken();

export function subscribeAdmin(listener: (isAdmin: boolean) => void) {
  adminListeners.add(listener);
  // Login/logout em outra aba do mesmo navegador
  if (!storageListenerAttached && typeof window !== 'undefined') {
    storageListenerAttached = true;
    window.addEventListener('storage', event => {
      if (event.key === ADMIN_TOKEN_KEY || event.key === null) emitAdmin();
    });
  }
  return () => {
    adminListeners.delete(listener);
  };
}

export async function loginAdmin(baseUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await parseBody(response)) as { token?: string; error?: string } | null;
    if (response.ok && data?.token) {
      storageSet(ADMIN_TOKEN_KEY, data.token);
      emitAdmin();
      return { ok: true };
    }
    return { ok: false, error: data?.error || `Erro ${response.status} ao entrar` };
  } catch (error) {
    const message = (error as Error)?.name === 'AbortError' ? 'tempo esgotado' : (error as Error)?.message || 'erro de rede';
    return { ok: false, error: `Sem conexão com o servidor: ${message}` };
  }
}

export function logoutAdmin() {
  storageRemove(ADMIN_TOKEN_KEY);
  emitAdmin();
}

// =========================================================================
// Conta de usuário (e-mail + senha). Guarda só o token e os dados da conta, nunca a senha.
// O token de convidado continua guardado: é para ele que se volta ao sair
// =========================================================================

const ACCOUNT_TOKEN_KEY = 'account_token';
const ACCOUNT_USER_KEY = 'account_user';

export type AccountUser = { id: number; email: string; display_name?: string; role?: string };
export type AccountSession = { token: string; user: AccountUser };

export const getAccountToken = () => storageGet(ACCOUNT_TOKEN_KEY);

export function getAccountUser(): AccountUser | null {
  try {
    return JSON.parse(storageGet(ACCOUNT_USER_KEY) || 'null') as AccountUser | null;
  } catch {
    return null;
  }
}

const accountListeners = new Set<(renew: boolean) => void>();

/** Avisado a cada troca de token. renew = só renovou (refresh, /me): a conta é a mesma */
export function subscribeAccount(listener: (renew: boolean) => void) {
  accountListeners.add(listener);
  return () => {
    accountListeners.delete(listener);
  };
}

// A ÚNICA função que troca o token da conta. session null = volta ao convidado.
// renew: só renovou o token ou os dados (refresh, /me): quem depende da conta não recarrega
export function switchAccountToken(session: AccountSession | null, { renew = false } = {}) {
  if (session) {
    storageSet(ACCOUNT_TOKEN_KEY, session.token);
    storageSet(ACCOUNT_USER_KEY, JSON.stringify(session.user));
  } else {
    storageRemove(ACCOUNT_TOKEN_KEY);
    storageRemove(ACCOUNT_USER_KEY);
  }
  accountListeners.forEach(listener => listener(renew));
}
