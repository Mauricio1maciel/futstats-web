import { deleteAccount, login, refreshAccount, register, validateAccountForm } from './account';
import { fetchApi } from './api';
import { getAccountToken, getAccountUser, getGuestToken, switchAccountToken } from './auth';

type Call = { url: string; auth: string | null; body: Record<string, unknown> | null; method: string };

function mockFetch(handler: (url: string) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, auth: new Headers(init.headers).get('Authorization'), body: init.body ? JSON.parse(String(init.body)) : null, method: init.method || 'GET' });
      return handler(url);
    }),
  );
  return calls;
}

const json = (body: unknown, status = 200) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = { id: 7, email: 'ana@x.dev', display_name: 'Ana', role: 'user' };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jwt_token', 'guest-1');
  localStorage.setItem('device_id', 'device-1');
});
afterEach(() => vi.unstubAllGlobals());

describe('validação do formulário', () => {
  it('e-mail, senha de 8 a 72 e nome até 60', () => {
    expect(validateAccountForm({ email: 'ana', password: '12345678' })).toMatch(/e-mail/);
    expect(validateAccountForm({ email: 'ana@x.dev', password: '1234567' })).toMatch(/8/);
    expect(validateAccountForm({ email: 'ana@x.dev', password: 'x'.repeat(73) })).toMatch(/72/);
    expect(validateAccountForm({ email: 'ana@x.dev', password: '12345678', name: 'n'.repeat(61) })).toMatch(/60/);
    expect(validateAccountForm({ email: ' ana@x.dev ', password: '12345678', name: 'Ana' })).toBeNull();
  });
});

describe('entrar e criar conta', () => {
  it('manda o device_id e o token de convidado do aparelho; guarda só o token da conta', async () => {
    const calls = mockFetch(() => json({ token: 'acc-1', type: 'user', role: 'user', user }, 201));
    expect(await register('ana@x.dev', 'senha-forte', 'Ana')).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ method: 'POST', auth: 'Bearer guest-1', body: { email: 'ana@x.dev', password: 'senha-forte', display_name: 'Ana', device_id: 'device-1' } });
    expect(getAccountToken()).toBe('acc-1');
    expect(getAccountUser()).toEqual(user);
    expect(getGuestToken()).toBe('guest-1'); // guardado para quando sair
    expect(JSON.stringify(localStorage)).not.toContain('senha-forte');
  });

  it('mensagens dos erros da API', async () => {
    mockFetch(() => json({ error: 'x' }, 409));
    expect(await register('ana@x.dev', 'senha-forte', '')).toEqual({ ok: false, error: 'Já existe uma conta com este e-mail' });
    mockFetch(() => json({ error: 'x' }, 401));
    expect(await login('ana@x.dev', 'errada123')).toEqual({ ok: false, error: 'E-mail ou senha incorretos' });
    mockFetch(() => json({ error: 'x' }, 429));
    expect(await login('ana@x.dev', 'errada123')).toEqual({ ok: false, error: 'Muitas tentativas, tente em alguns segundos' });
    expect(getAccountToken()).toBeNull();
  });
});

describe('logado', () => {
  beforeEach(() => switchAccountToken({ token: 'acc-1', user }));

  it('as rotas usam o token da conta', async () => {
    const calls = mockFetch(() => json({ matches: [] }));
    await fetchApi('/push/subscriptions', {}, { guestOnly: true });
    expect(calls[0].auth).toBe('Bearer acc-1');
  });

  it('refresh troca o token; 401 volta ao convidado', async () => {
    mockFetch(() => json({ token: 'acc-2', user }));
    await refreshAccount();
    expect(getAccountToken()).toBe('acc-2');
    mockFetch(() => json({ error: 'expirado' }, 401));
    await refreshAccount();
    expect(getAccountToken()).toBeNull();
  });

  it('token da conta recusado numa rota qualquer: volta ao convidado e repete', async () => {
    const calls = mockFetch(() => (calls.length === 1 ? json({ error: 'x' }, 401) : json(['2026'])));
    expect(await fetchApi('/seasons?league=ACC')).toEqual(['2026']);
    expect(calls.map(c => c.auth)).toEqual(['Bearer acc-1', 'Bearer guest-1']);
    expect(getAccountToken()).toBeNull();
  });

  it('apagar: 401 = senha incorreta; 204 volta ao convidado', async () => {
    mockFetch(() => json({ error: 'x' }, 401));
    expect(await deleteAccount('errada')).toEqual({ ok: false, error: 'Senha incorreta' });
    expect(getAccountToken()).toBe('acc-1');
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    expect(await deleteAccount('senha-forte')).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ method: 'DELETE', auth: 'Bearer acc-1', body: { password: 'senha-forte' } });
    expect(getAccountToken()).toBeNull();
  });
});
