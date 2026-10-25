import { buildEndpoint, fetchApi, requestApi, RETRY_DELAY_MS, withParams } from './api';
import { readCached, saveCached } from './apiCache';
import { getAdminToken } from './auth';
import { dismissNetworkErrors, subscribeNetworkErrors, type NetworkErrorState } from './networkErrors';
import { subscribeToasts, type Toast } from './toast';

const BASE = 'https://futapp-r38z.onrender.com';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Call = { url: string; auth: string | null; method: string };

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, auth: new Headers(init.headers).get('Authorization'), method: init.method || 'GET' });
      return handler(url, init);
    }),
  );
  return calls;
}

let networkState: NetworkErrorState;
let toasts: Toast[];
let unsubscribe: (() => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  dismissNetworkErrors(false);
  unsubscribe = [subscribeNetworkErrors(s => (networkState = s)), subscribeToasts(t => (toasts = t))];
});

afterEach(() => {
  unsubscribe.forEach(fn => fn());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('montagem de endpoints', () => {
  it('deixa de fora valores vazios e codifica', () => {
    expect(buildEndpoint('/matches', { league: 'BSA', season: '', round: 3 })).toBe('/matches?league=BSA&round=3');
    expect(buildEndpoint('/search', { q: 'são paulo' })).toBe('/search?q=s%C3%A3o%20paulo');
    expect(withParams('/standings?league=BSA', { update: 'true', nocache: 'true' })).toBe('/standings?league=BSA&update=true&nocache=true');
    expect(withParams('/seasons', { update: undefined })).toBe('/seasons');
  });
});

describe('autenticação', () => {
  it('várias requisições sem token compartilham uma única chamada a /auth/guest', async () => {
    const calls = mockFetch(url => (url.endsWith('/auth/guest') ? json({ token: 'guest-1' }) : json([])));
    await Promise.all([fetchApi('/seasons?league=BSA'), fetchApi('/seasons?league=PL'), fetchApi('/seasons?league=CL')]);
    expect(calls.filter(c => c.url.endsWith('/auth/guest'))).toHaveLength(1);
    expect(calls.filter(c => c.url.includes('/seasons')).every(c => c.auth === 'Bearer guest-1')).toBe(true);
    expect(localStorage.getItem('jwt_token')).toBe('guest-1');
    expect(localStorage.getItem('device_id')).toBeTruthy();
  });

  it('no 401 gera um novo token de convidado e repete uma vez', async () => {
    localStorage.setItem('jwt_token', 'vencido');
    const calls = mockFetch((url, init) => {
      if (url.endsWith('/auth/guest')) return json({ token: 'novo' });
      return new Headers(init.headers).get('Authorization') === 'Bearer novo' ? json(['2026']) : json({ error: 'token' }, 401);
    });
    expect(await fetchApi('/seasons?league=BSA')).toEqual(['2026']);
    expect(calls.map(c => c.url.replace(BASE, ''))).toEqual(['/seasons?league=BSA', '/auth/guest', '/seasons?league=BSA']);
  });

  it('admin com token vencido volta para convidado e avisa', async () => {
    localStorage.setItem('admin_jwt_token', 'admin-velho');
    localStorage.setItem('jwt_token', 'guest-ok');
    mockFetch((_url, init) =>
      new Headers(init.headers).get('Authorization') === 'Bearer guest-ok' ? json([1]) : json({ error: 'expirado' }, 401),
    );
    expect(await fetchApi('/standings?league=BSA')).toEqual([1]);
    expect(getAdminToken()).toBeNull();
    expect(toasts.map(t => t.title)).toContain('Sessão de admin expirada');
  });

  it('não guarda no cache as respostas pedidas com token de admin', async () => {
    localStorage.setItem('admin_jwt_token', 'admin');
    mockFetch(() => json([1]));
    await fetchApi('/standings?league=BSA&update=true');
    expect(readCached('/standings?league=BSA')).toBeNull();
  });

  it('as rotas /push usam o token de convidado mesmo com admin logado', async () => {
    localStorage.setItem('admin_jwt_token', 'admin');
    localStorage.setItem('jwt_token', 'guest');
    const calls = mockFetch(() => json({ matches: [] }));
    await requestApi('/push/subscriptions', {}, { guestOnly: true });
    expect(calls[0].auth).toBe('Bearer guest');
  });
});

describe('rede ruim', () => {
  it('GET com erro de rede tenta de novo depois de 1,5 s', async () => {
    vi.useFakeTimers();
    localStorage.setItem('jwt_token', 'guest');
    let attempts = 0;
    mockFetch(() => {
      attempts++;
      if (attempts === 1) throw new TypeError('Failed to fetch');
      return json(['ok']);
    });
    const promise = fetchApi('/seasons?league=BSA');
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await promise).toEqual(['ok']);
    expect(attempts).toBe(2);
  });

  it('POST não repete', async () => {
    localStorage.setItem('jwt_token', 'guest');
    let attempts = 0;
    mockFetch(() => {
      attempts++;
      throw new TypeError('Failed to fetch');
    });
    expect(await requestApi('/push/register', { method: 'POST', body: '{}' })).toBeNull();
    expect(attempts).toBe(1);
  });

  it('sem rede devolve a cópia guardada e avisa de quando ela é', async () => {
    vi.useFakeTimers();
    localStorage.setItem('jwt_token', 'guest');
    saveCached('/standings?league=BSA', [{ position: 1 }]);
    const savedAt = readCached('/standings?league=BSA')!.savedAt;
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const promise = requestApi('/standings?league=BSA');
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    const result = await promise;
    expect(result).toMatchObject({ status: 200, data: [{ position: 1 }], fromCache: true });
    expect(networkState.visible).toBe(true);
    expect(networkState.cachedAt).toBe(savedAt);
    expect(networkState.requests[0].endpoint).toBe('/standings?league=BSA');
  });

  it('agrupa as falhas por rota, com contador', async () => {
    vi.useFakeTimers();
    localStorage.setItem('jwt_token', 'guest');
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const all = Promise.all([fetchApi('/matches?league=BSA&date=2026-10-18'), fetchApi('/matches?league=PL&date=2026-10-18')]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await all;
    expect(networkState.total).toBe(2);
    expect(networkState.requests).toHaveLength(1);
    expect(networkState.requests[0].count).toBe(2);
  });

  it('mostra a cópia guardada na hora e entrega a da rede depois', async () => {
    localStorage.setItem('jwt_token', 'guest');
    saveCached('/seasons?league=BSA', ['2025']);
    mockFetch(() => json(['2026', '2025']));
    const seen: unknown[] = [];
    const data = await fetchApi('/seasons?league=BSA', {}, { onCached: cached => seen.push(cached) });
    expect(seen).toEqual([['2025']]);
    expect(data).toEqual(['2026', '2025']);
    expect(readCached('/seasons?league=BSA')?.data).toEqual(['2026', '2025']);
  });

  it('lê o JSON de erro mesmo com Content-Type errado', async () => {
    localStorage.setItem('jwt_token', 'guest');
    mockFetch(() => new Response('{"error":"Jogo não disponível"}', { status: 404, headers: { 'Content-Type': 'text/plain' } }));
    const result = await requestApi('/match/history?id=1&league=BSA');
    expect(result).toEqual({ status: 404, data: { error: 'Jogo não disponível' } });
    expect(await fetchApi('/match/history?id=1&league=BSA')).toBeNull();
  });
});

describe('limite de pedidos (429)', () => {
  const limited = (retryAfter: string) =>
    new Response(JSON.stringify({ error: 'Muitos pedidos em pouco tempo. Tente de novo em 12 s.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
    });

  it('não repete na hora e não volta à rede antes do Retry-After', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    const calls = mockFetch(() => limited('12'));
    expect(await fetchApi('/rate-a?league=BSA')).toBeNull();
    expect(calls).toHaveLength(1);
    expect(networkState.requests[0].message).toBe('Muitos pedidos em pouco tempo. Tente de novo em 12 s.');

    const again = await requestApi('/rate-a?league=PL');
    expect(again?.status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it('mostra a cópia guardada quando houver', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    saveCached('/standings?league=RATE', [{ team: 'Flamengo' }]);
    mockFetch(() => limited('5'));
    const result = await requestApi('/standings?league=RATE');
    expect(result).toMatchObject({ status: 200, fromCache: true, data: [{ team: 'Flamengo' }] });
  });

  it('volta a pedir depois do Retry-After', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    localStorage.setItem('jwt_token', 'guest-1');
    let first = true;
    const calls = mockFetch(() => {
      if (first) {
        first = false;
        return limited('3');
      }
      return json({ ok: true });
    });
    await fetchApi('/rate-b');
    vi.setSystemTime(Date.now() + 3500);
    expect(await fetchApi('/rate-b')).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });
});

describe('etiqueta (ETag) e 304', () => {
  const withEtag = (body: unknown, etag: string) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });

  it('manda If-None-Match com a etiqueta guardada e usa a cópia no 304', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    const sent: (string | null)[] = [];
    let round = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        sent.push(new Headers(init.headers).get('If-None-Match'));
        round++;
        return round === 1 ? withEtag(['2026', '2025'], 'W/"abc"') : new Response(null, { status: 304, headers: { ETag: 'W/"abc"' } });
      }),
    );
    expect(await fetchApi('/seasons?league=ETAG')).toEqual(['2026', '2025']);
    const before = readCached('/seasons?league=ETAG')!.savedAt;
    expect(readCached('/seasons?league=ETAG')?.etag).toBe('W/"abc"');

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(before + 60_000);
    const second = await requestApi('/seasons?league=ETAG');
    expect(second).toEqual({ status: 200, data: ['2026', '2025'] });
    expect(sent).toEqual([null, 'W/"abc"']);
    // 304 não grava null: a cópia continua, com o savedAt renovado
    expect(readCached('/seasons?league=ETAG')).toMatchObject({ data: ['2026', '2025'], savedAt: before + 60_000 });
  });

  it('304 sem cópia guardada: pede de novo sem a etiqueta', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    saveCached('/seasons?league=GONE', ['2026'], 'W/"old"');
    const sent: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        const tag = new Headers(init.headers).get('If-None-Match');
        sent.push(tag);
        // A cópia some entre o envio e a resposta (ex: outra aba limpou o armazenamento)
        if (tag) {
          localStorage.clear();
          localStorage.setItem('jwt_token', 'guest-1');
          return new Response(null, { status: 304 });
        }
        return withEtag(['2026', '2025'], 'W/"new"');
      }),
    );
    expect(await fetchApi('/seasons?league=GONE')).toEqual(['2026', '2025']);
    expect(sent).toEqual(['W/"old"', null]);
  });

  it('admin não manda etiqueta', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    localStorage.setItem('admin_jwt_token', 'admin-1');
    saveCached('/seasons?league=ADM', ['2026'], 'W/"x"');
    const sent: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        sent.push(new Headers(init.headers).get('If-None-Match'));
        return json(['2026']);
      }),
    );
    await fetchApi('/seasons?league=ADM');
    expect(getAdminToken()).toBe('admin-1');
    expect(sent).toEqual([null]);
  });
});

describe('ao vivo: etiqueta só na memória', () => {
  it('a recarga manda If-None-Match e o 304 devolve a última resposta, sem gravar cópia local', async () => {
    localStorage.setItem('jwt_token', 'guest-1');
    const sent: (string | null)[] = [];
    let round = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        sent.push(new Headers(init.headers).get('If-None-Match'));
        round++;
        return round === 1
          ? new Response(JSON.stringify([{ match_id: 1, clock: "35'" }]), { status: 200, headers: { 'Content-Type': 'application/json', ETag: 'W/"live1"' } })
          : new Response(null, { status: 304 });
      }),
    );
    expect(await fetchApi('/matches/live?league=MEM')).toEqual([{ match_id: 1, clock: "35'" }]);
    expect(await fetchApi('/matches/live?league=MEM')).toEqual([{ match_id: 1, clock: "35'" }]);
    expect(sent).toEqual([null, 'W/"live1"']);
    expect(readCached('/matches/live?league=MEM')).toBeNull();
  });
});
