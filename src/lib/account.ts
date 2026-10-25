// Conta de usuário (docs/API.md, "Contas de usuário"). O convidado continua existindo: a conta
// só guarda o que se segue para valer em vários aparelhos. No cadastro e no login vão o device_id
// e o token de convidado DESTE aparelho: é assim que o que ele seguia passa para a conta
import { authenticateGuest, getAccountToken, getAccountUser, getGuestToken, getOrCreateDeviceId, switchAccountToken, type AccountUser } from './auth';
import { getBaseUrl } from './config';
import { fetchWithTimeout, parseBody } from './http';
import { showToast } from './toast';

export type AccountResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validação antes de mandar: e-mail, senha de 8 a 72 e nome de até 60. null = tudo certo */
export function validateAccountForm({ email, password, name = '' }: { email: string; password: string; name?: string }) {
  if (!EMAIL_RE.test(email.trim())) return 'Digite um e-mail válido.';
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (password.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (name.trim().length > 60) return 'O nome pode ter no máximo 60 caracteres.';
  return null;
}

async function call(path: string, init: RequestInit & { token?: string | null } = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`, { ...init, headers });
  return { status: response.status, data: (await parseBody(response)) as Record<string, unknown> | null };
}

const networkError = (error: unknown): AccountResult => ({
  ok: false,
  error: (error as Error)?.name === 'AbortError' ? 'O servidor demorou para responder. Tente de novo.' : 'Sem conexão com o servidor.',
});

function errorFor(status: number, data: Record<string, unknown> | null, kind: 'login' | 'register' | 'delete') {
  if (status === 429) return 'Muitas tentativas, tente em alguns segundos';
  if (status === 409) return 'Já existe uma conta com este e-mail';
  if (status === 401) return kind === 'delete' ? 'Senha incorreta' : 'E-mail ou senha incorretos';
  if (status === 403) return 'Não foi possível ligar este aparelho à conta. Recarregue a página e tente de novo.';
  return (typeof data?.error === 'string' && data.error) || `Erro ${status}. Tente de novo.`;
}

async function enter(kind: 'login' | 'register', body: Record<string, unknown>): Promise<AccountResult> {
  try {
    // O token de convidado deste aparelho vai junto: leva para a conta o que ele já seguia
    const guestToken = await authenticateGuestToken();
    const { status, data } = await call(kind === 'login' ? '/auth/login' : '/auth/register', {
      method: 'POST',
      token: guestToken,
      body: JSON.stringify({ ...body, device_id: getOrCreateDeviceId() }),
    });
    const token = typeof data?.token === 'string' ? data.token : '';
    if ((status === 200 || status === 201) && token && data?.user) {
      switchAccountToken({ token, user: data.user as AccountUser });
      return { ok: true };
    }
    return { ok: false, error: errorFor(status, data, kind) };
  } catch (error) {
    return networkError(error);
  }
}

// Token de convidado atual (pede um novo se não houver)
async function authenticateGuestToken() {
  return getGuestToken() || (await authenticateGuest(getBaseUrl()));
}

export const login = (email: string, password: string) => enter('login', { email: email.trim(), password });

export const register = (email: string, password: string, name: string) =>
  enter('register', { email: email.trim(), password, ...(name.trim() ? { display_name: name.trim() } : {}) });

// A conta expirou ou foi apagada: volta ao convidado e avisa
function expire() {
  switchAccountToken(null);
  showToast('Sua sessão expirou', 'Entre de novo para usar sua conta.');
}

/** Ao abrir o site logado: troca o token por um novo (vale 30 dias). 401 = expirou */
export async function refreshAccount() {
  const token = getAccountToken();
  if (!token) return;
  try {
    const { status, data } = await call('/auth/refresh', { method: 'POST', token });
    if (status === 401) return expire();
    if (status === 200 && typeof data?.token === 'string') {
      const user = (data.user as AccountUser | undefined) ?? getAccountUser();
      if (user) switchAccountToken({ token: data.token, user }, { renew: true });
    }
  } catch {
    // sem rede: fica o token atual
  }
}

/** Dados da conta (/me). null = falhou; a 401 já volta ao convidado */
export async function fetchMe(): Promise<AccountUser | null> {
  const token = getAccountToken();
  if (!token) return null;
  try {
    const { status, data } = await call('/me', { token });
    if (status === 401) {
      expire();
      return null;
    }
    if (status === 200 && data) {
      const user = data as unknown as AccountUser;
      switchAccountToken({ token, user }, { renew: true });
      return user;
    }
  } catch {
    // sem rede
  }
  return null;
}

/** Sair: avisa a API (o token deixa de valer) e volta ao convidado */
export async function logout() {
  const token = getAccountToken();
  if (token) await call('/auth/logout', { method: 'POST', token }).catch(() => null);
  switchAccountToken(null);
}

/** Apagar a conta (confirma com a senha). Tudo o que ela segue é apagado */
export async function deleteAccount(password: string): Promise<AccountResult> {
  const token = getAccountToken();
  if (!token) return { ok: false, error: 'Você não está logado.' };
  try {
    const { status, data } = await call('/me', { method: 'DELETE', token, body: JSON.stringify({ password }) });
    if (status === 204) {
      switchAccountToken(null);
      showToast('Conta apagada', 'Você está usando o FutStats como convidado.');
      return { ok: true };
    }
    return { ok: false, error: errorFor(status, data, 'delete') };
  } catch (error) {
    return networkError(error);
  }
}
