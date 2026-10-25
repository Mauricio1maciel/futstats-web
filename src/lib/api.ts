import { cacheKeyFor, getCachedEtag, isCacheableEndpoint, isLiveEndpoint, readCached, saveCached } from './apiCache';
import { authenticateGuest, getAdminToken, getGuestToken, logoutAdmin } from './auth';
import { getBaseUrl } from './config';
import { describeNetworkError, fetchWithTimeout, parseBody } from './http';
import { reportNetworkError } from './networkErrors';
import { showToast } from './toast';

// GET que falha por rede/tempo esgotado tenta mais uma vez depois disso
export const RETRY_DELAY_MS = 1500;

export type ApiResult<T = unknown> = { status: number; data: T | null; fromCache?: boolean; savedAt?: number };

export type ApiExtraOptions<T = unknown> = {
  /** Usa sempre o token de convidado, mesmo com admin logado (as rotas /push exigem isso) */
  guestOnly?: boolean;
  /**
   * GET: "mostra o que tem e atualiza por trás". Se houver cópia guardada, ela é entregue aqui
   * na hora; a versão nova da rede chega depois, como retorno normal da função.
   */
  onCached?: (data: T) => void;
};

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

// "/matches" + { league: 'BSA', round: 3, season: '' } -> "/matches?league=BSA&round=3".
// Valores vazios ficam de fora; a ordem dos parâmetros é a da chamada (e define a chave do cache)
export function buildEndpoint(path: string, params: Record<string, QueryValue> = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

// Acrescenta parâmetros a um endpoint que já pode ter query
export function withParams(endpoint: string, params: Record<string, QueryValue> = {}) {
  const extra = buildEndpoint('', params);
  if (!extra) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${extra.slice(1)}`;
}

// Parâmetros do "atualizar": fura o cache do servidor e, com admin logado, pede a atualização na fonte
export function refreshParams(isAdmin: boolean, adminParam: 'update' | 'force_update' = 'update'): QueryParams {
  return { [adminParam]: isAdmin ? 'true' : undefined, nocache: 'true' };
}

// 429: a API limita os pedidos por endereço. Até o Retry-After passar, a rota não vai à rede
const DEFAULT_RETRY_AFTER_S = 30;
const blockedUntil = new Map<string, number>();
const routeOf = (endpoint: string) => endpoint.split('?')[0];

export function retryAfterSeconds(header: string | null) {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  // Também pode vir como data HTTP
  const date = header ? Date.parse(header) : NaN;
  if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return DEFAULT_RETRY_AFTER_S;
}

const rateLimitMessage = (seconds: number) => `Muitos pedidos em pouco tempo. Tente de novo em ${seconds} s.`;

// Ao vivo (/matches/live, live=true): não vai para a cópia local (placar velho engana ao abrir o site),
// mas a última resposta e a etiqueta ficam na memória da página. Assim a recarga de 15 s manda
// If-None-Match e a resposta igual volta 304, quase sem gastar internet
const liveMemory = new Map<string, { etag: string; data: unknown }>();
const MAX_LIVE_MEMORY = 50;

function rememberLive(endpoint: string, etag: string | null | undefined, data: unknown) {
  const key = cacheKeyFor(endpoint);
  liveMemory.delete(key);
  if (!etag || data == null) return;
  liveMemory.set(key, { etag, data });
  if (liveMemory.size > MAX_LIVE_MEMORY) liveMemory.delete(liveMemory.keys().next().value!);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Faz o pedido uma vez (com renovação de token no 401). Lança erro em falha de rede/tempo esgotado.
// etag: a da cópia guardada; vai em If-None-Match e a API responde 304 sem corpo se nada mudou
async function sendRequest(endpoint: string, options: RequestInit, guestOnly: boolean, etag: string | null = null) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  // Admin logado: o token de admin vale em todas as rotas. Senão, o de convidado
  const adminToken = guestOnly ? null : getAdminToken();
  let token = adminToken || getGuestToken() || (await authenticateGuest(baseUrl));

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  // Admin não guarda cópia (recebe sempre dado fresco): sem etiqueta
  if (etag && !adminToken) headers.set('If-None-Match', etag);
  const send = async () => {
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetchWithTimeout(url, { ...options, headers });
  };

  let response = await send();
  let usedAdminToken = !!adminToken;

  if (response.status === 401) {
    const rejected = token;
    if (adminToken) {
      // Token de admin expirou: volta para convidado e avisa
      logoutAdmin();
      usedAdminToken = false;
      headers.delete('If-None-Match');
      showToast('Sessão de admin expirada', 'Faça login de novo para usar o modo admin.');
      token = getGuestToken() || (await authenticateGuest(baseUrl));
    } else {
      // Outra requisição já pode ter renovado o token enquanto esta esperava
      const stored = getGuestToken();
      token = stored && stored !== rejected ? stored : await authenticateGuest(baseUrl);
    }

    if (token) {
      response = await send();
      // O token de convidado guardado também podia estar vencido
      if (response.status === 401 && adminToken) {
        token = await authenticateGuest(baseUrl);
        if (token) response = await send();
      }
    }
  }

  return {
    status: response.status,
    data: await parseBody(response),
    usedAdminToken,
    etag: response.headers.get('ETag'),
    retryAfter: response.status === 429 ? retryAfterSeconds(response.headers.get('Retry-After')) : 0,
  };
}

// Igual ao fetchApi, mas devolve também o status HTTP (tela de admin) e se veio da cópia local
export async function requestApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  { guestOnly = false, onCached }: ApiExtraOptions<T> = {},
): Promise<ApiResult<T> | null> {
  const isGet = (options.method || 'GET').toUpperCase() === 'GET';
  const cacheable = isGet && isCacheableEndpoint(endpoint);
  const liveOnly = isGet && endpoint.startsWith('/') && isLiveEndpoint(endpoint);

  // A cópia guardada vai para a tela na hora; a rede atualiza depois
  if (cacheable && onCached) {
    const cached = readCached<T>(endpoint);
    if (cached) {
      try {
        onCached(cached.data);
      } catch {
        // uma cópia em formato antigo não pode derrubar a tela
      }
    }
  }

  // Sem conexão / servidor fora: usa a cópia local e avisa de quando ela é
  const fallbackToCache = (message: string): ApiResult<T> | null => {
    const cached = cacheable ? readCached<T>(endpoint) : null;
    reportNetworkError(getBaseUrl(), endpoint, message, cached?.savedAt);
    return cached ? { status: 200, data: cached.data, fromCache: true, savedAt: cached.savedAt } : null;
  };

  // Ainda dentro do Retry-After de um 429: nem tenta (cópia local ou o aviso)
  const route = routeOf(endpoint);
  const waitMs = (blockedUntil.get(route) || 0) - Date.now();
  if (waitMs > 0) {
    return fallbackToCache(rateLimitMessage(Math.ceil(waitMs / 1000))) ?? { status: 429, data: null };
  }

  try {
    const etag = cacheable ? getCachedEtag(endpoint) : liveOnly ? (liveMemory.get(cacheKeyFor(endpoint))?.etag ?? null) : null;
    let result;
    try {
      result = await sendRequest(endpoint, options, guestOnly, etag);
    } catch (error) {
      // POST/DELETE não repetem sozinhos; sem internet nenhuma, não adianta esperar
      if (!isGet || isOffline()) throw error;
      await sleep(RETRY_DELAY_MS);
      result = await sendRequest(endpoint, options, guestOnly, etag);
    }

    // 304: nada mudou desde a cópia guardada. Ela vale como resposta e só ganha um savedAt novo.
    // Sem a cópia (apagada nesse meio-tempo), pede de novo sem a etiqueta
    if (result.status === 304 && liveOnly) {
      const remembered = liveMemory.get(cacheKeyFor(endpoint));
      if (remembered) return { status: 200, data: remembered.data as T };
      result = await sendRequest(endpoint, options, guestOnly);
    }
    if (result.status === 304) {
      const cached = readCached<T>(endpoint);
      if (cached) {
        saveCached(endpoint, cached.data, result.etag || cached.etag);
        return { status: 200, data: cached.data };
      }
      result = await sendRequest(endpoint, options, guestOnly);
    }

    if (result.status === 429) {
      blockedUntil.set(route, Date.now() + result.retryAfter * 1000);
      const body = result.data as { error?: unknown } | null;
      const message = typeof body?.error === 'string' && body.error ? body.error : rateLimitMessage(result.retryAfter);
      return fallbackToCache(message) ?? { status: 429, data: result.data as T };
    }

    // Servidor fora do ar (502/503...): melhor mostrar a cópia guardada do que um erro
    if (cacheable && result.status >= 500) {
      const fallback = fallbackToCache(`Servidor respondeu ${result.status}`);
      if (fallback) return fallback;
    }

    if (liveOnly && !result.usedAdminToken) rememberLive(endpoint, result.status === 200 ? result.etag : null, result.data);

    // Guarda só respostas OK de convidado (admin sempre recebe dado fresco: X-Cache BYPASS)
    if (cacheable && result.status < 400 && result.data != null && !result.usedAdminToken) {
      saveCached(endpoint, result.data, result.etag);
    }

    return { status: result.status, data: result.data as T };
  } catch (error) {
    return fallbackToCache(describeNetworkError(error));
  }
}

// Usado pelas telas: os dados (da rede, ou da cópia local se a rede falhar) ou null
export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  extra: ApiExtraOptions<T> = {},
): Promise<T | null> {
  const result = await requestApi<T>(endpoint, options, extra);
  if (!result || result.status >= 400) return null;
  return result.data;
}

// Só a cópia local, sem ir à rede (null se não houver)
export function getCachedApi<T = unknown>(endpoint: string): T | null {
  return isCacheableEndpoint(endpoint) ? readCached<T>(endpoint)?.data ?? null : null;
}
