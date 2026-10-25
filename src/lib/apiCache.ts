// Cópia local das respostas GET: abre rápido e funciona com internet ruim.
// O localStorage tem limite (~5 MB no Safari), então o tamanho é controlado aqui.
import { storageGetJson, storageKeys, storageRemove, storageSet } from './storage';

const PREFIX = 'api_cache:';
const INDEX_KEY = 'api_cache_index';
export const MAX_ENTRIES = 50;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ENTRY_CHARS = 1_000_000; // respostas maiores que ~1 MB não são guardadas

// Nunca guardar: dados do aparelho/usuário e ações de admin. A busca também fica de fora: cada termo
// digitado viraria uma entrada e empurraria para fora do limite de 50 os jogos e tabelas guardados
const NOT_CACHEABLE = ['/push/', '/auth/', '/admin/', '/search'];
// Respostas grandes: só a última pedida fica guardada (ex: /players de uma liga, ~230 KB)
const KEEP_ONLY_LATEST = ['/players?'];
// Parâmetros que só furam o cache do servidor: não mudam a chave
const IGNORED_PARAMS = /^(nocache|update|force_update)=/;

/** etag: a etiqueta (ETag) que a API mandou com esses dados, para pedir de novo com If-None-Match */
export type CachedResponse<T = unknown> = { data: T; savedAt: number; etag?: string };

type CacheIndex = Record<string, number>; // chave -> savedAt

// Etiquetas em memória (chave -> etag; null = sem etiqueta), para não ler o localStorage a cada pedido
const etags = new Map<string, string | null>();

function removeEntry(key: string) {
  etags.delete(key);
  storageRemove(PREFIX + key);
}

// Chave = caminho + parâmetros (sem token), ignorando os que só furam o cache
export function cacheKeyFor(endpoint: string) {
  const [path, query = ''] = endpoint.split('?');
  const params = query.split('&').filter(p => p && !IGNORED_PARAMS.test(p));
  return params.length ? `${path}?${params.join('&')}` : path;
}

// Placar ao vivo guardado engana: um jogo salvo como "ao vivo" pode já ter acabado.
// Por isso /matches/live e a classificação ao vivo (live=true) não entram na cópia local
export const isLiveEndpoint = (endpoint: string) =>
  endpoint.startsWith('/matches/live') || /[?&]live=true(&|$)/.test(endpoint);

export function isCacheableEndpoint(endpoint: string) {
  return endpoint.startsWith('/') && !NOT_CACHEABLE.some(prefix => endpoint.startsWith(prefix)) && !isLiveEndpoint(endpoint);
}

function loadIndex(): CacheIndex {
  const index = storageGetJson<CacheIndex>(INDEX_KEY) || {};
  // Descarta cópias com mais de 7 dias
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(index)) {
    if (!(now - index[key] <= MAX_AGE_MS)) {
      delete index[key];
      removeEntry(key);
      changed = true;
    }
  }
  if (changed) storageSet(INDEX_KEY, JSON.stringify(index));
  return index;
}

export function readCached<T = unknown>(endpoint: string): CachedResponse<T> | null {
  const cached = storageGetJson<CachedResponse<T>>(PREFIX + cacheKeyFor(endpoint));
  if (!cached?.savedAt || Date.now() - cached.savedAt > MAX_AGE_MS) return null;
  return cached;
}

// Etiqueta da cópia guardada (só existe se a cópia existe)
export function getCachedEtag(endpoint: string): string | null {
  const key = cacheKeyFor(endpoint);
  if (!etags.has(key)) etags.set(key, readCached(endpoint)?.etag || null);
  return etags.get(key) ?? null;
}

// Apaga as mais antigas até sobrar `keep` entradas
function evictOldest(index: CacheIndex, keep: number) {
  const keys = Object.keys(index).sort((a, b) => index[a] - index[b]);
  while (keys.length > keep) {
    const oldest = keys.shift()!;
    delete index[oldest];
    removeEntry(oldest);
  }
}

export function saveCached(endpoint: string, data: unknown, etag?: string | null) {
  const key = cacheKeyFor(endpoint);
  const savedAt = Date.now();
  let json: string;
  try {
    json = JSON.stringify(etag ? { data, savedAt, etag } : { data, savedAt });
  } catch {
    return;
  }
  if (json.length > MAX_ENTRY_CHARS) return;

  const index = loadIndex();

  const latestOnly = KEEP_ONLY_LATEST.find(prefix => key.startsWith(prefix));
  if (latestOnly) {
    for (const k of Object.keys(index)) {
      if (k !== key && k.startsWith(latestOnly)) {
        delete index[k];
        removeEntry(k);
      }
    }
  }

  index[key] = savedAt;
  evictOldest(index, MAX_ENTRIES); // passou de 50? Apaga as mais antigas

  // Armazenamento cheio: libera espaço apagando as mais antigas e tenta de novo
  let saved = storageSet(PREFIX + key, json);
  if (!saved) {
    evictOldest(index, Math.max(0, Object.keys(index).length - 10));
    index[key] = savedAt;
    saved = storageSet(PREFIX + key, json);
  }
  if (saved) etags.set(key, etag || null);
  else {
    delete index[key];
    etags.delete(key);
  }
  storageSet(INDEX_KEY, JSON.stringify(index));
}

export function clearApiCache() {
  for (const key of storageKeys()) {
    if (key.startsWith(PREFIX)) storageRemove(key);
  }
  storageRemove(INDEX_KEY);
  etags.clear();
}
