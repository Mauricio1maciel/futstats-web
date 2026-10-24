// Seguir times, ligas e jogos para receber avisos (push). Funciona na web pelo
// lib/webPush.ts (Web Push). Regras do app (docs/API.md, "Notificações push"):
// - sempre com o token de convidado (é o device_id que identifica o aparelho);
// - a estrela muda na hora e desfaz se a API falhar;
// - 409 = aparelho ainda não registrado: registra e repete;
// - tipos de aviso por inscrição: lista vazia não existe (vira "deixar de seguir").
import { buildEndpoint, requestApi } from './api';
import { storageGet, storageSet } from './storage';
import { showToast } from './toast';
import { enableErrorMessage, enableWebPush, enableWebPushDetailed, isWebPushEnabled } from './webPush';

export type FollowTarget =
  | { type: 'team'; teamId: string | number }
  | { type: 'league'; league: string }
  | { type: 'match'; matchId?: string | number; espnMatchId?: string | number };

export const PUSH_KINDS = ['lineup', 'start', 'goal', 'penalty', 'red_card', 'halftime', 'end'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export const KIND_LABELS: Record<string, string> = {
  lineup: 'Escalação',
  start: 'Início',
  goal: 'Gols e gols anulados',
  penalty: 'Pênaltis (VAR, perdidos e disputa)',
  red_card: 'Cartão vermelho',
  halftime: 'Intervalo',
  end: 'Fim de jogo',
};

type KindsByTarget = Record<string, string[]>;

export type Follows = {
  matches: string[];
  teams: string[];
  leagues: string[];
  kinds: { matches: KindsByTarget; teams: KindsByTarget; leagues: KindsByTarget };
  availableKinds: string[];
  /** Já sabe o que a pessoa segue? (notificações desligadas = não segue nada) */
  loaded: boolean;
};

const EMPTY: Follows = {
  matches: [],
  teams: [],
  leagues: [],
  kinds: { matches: {}, teams: {}, leagues: {} },
  availableKinds: [...PUSH_KINDS],
  loaded: false,
};

let follows: Follows = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function subscribeFollows(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getFollows = () => follows;

const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

function normalize(data: Record<string, unknown>): Follows {
  const kinds = (data.kinds || {}) as Partial<Follows['kinds']>;
  return {
    matches: strings(data.matches),
    teams: strings(data.teams),
    leagues: strings(data.leagues).map(code => code.toUpperCase()),
    kinds: { matches: kinds.matches || {}, teams: kinds.teams || {}, leagues: kinds.leagues || {} },
    availableKinds: strings(data.available_kinds).length ? strings(data.available_kinds) : [...PUSH_KINDS],
    loaded: true,
  };
}

// Onde o alvo fica na lista de inscrições e o ID que a identifica
function locate(target: FollowTarget): { list: 'matches' | 'teams' | 'leagues'; id: string } | null {
  if (target.type === 'team') return { list: 'teams', id: String(target.teamId) };
  if (target.type === 'league') return { list: 'leagues', id: target.league.toUpperCase() };
  if (target.matchId) return { list: 'matches', id: String(target.matchId) };
  // Jogo só com ID da ESPN (aba Ao Vivo): usa o match_id que a API devolveu ao seguir
  const known = target.espnMatchId != null ? espnToMatchId.get(String(target.espnMatchId)) : undefined;
  return known ? { list: 'matches', id: known } : null;
}

// ID da ESPN -> match_id do banco (guardado no navegador: vale também depois de recarregar)
const ESPN_MAP_KEY = 'follows_espn_map';
const espnToMatchId = new Map<string, string>(
  Object.entries(typeof window === 'undefined' ? {} : JSON.parse(storageGet(ESPN_MAP_KEY) || '{}') as Record<string, string>),
);
function rememberEspnMatch(espnId: string, matchId: string) {
  espnToMatchId.set(espnId, matchId);
  storageSet(ESPN_MAP_KEY, JSON.stringify(Object.fromEntries(Array.from(espnToMatchId).slice(-200))));
}

function targetBody(target: FollowTarget): Record<string, unknown> {
  if (target.type === 'team') return { team_id: target.teamId };
  if (target.type === 'league') return { league: target.league };
  return target.matchId ? { match_id: target.matchId } : { espn_match_id: target.espnMatchId };
}

export function isFollowing(state: Follows, target: FollowTarget) {
  const place = locate(target);
  return !!place && state[place.list].includes(place.id);
}

/** Tipos escolhidos para o alvo; null = todos (padrão) */
export function getKinds(state: Follows, target: FollowTarget): string[] | null {
  const place = locate(target);
  return place ? state.kinds[place.list][place.id] ?? null : null;
}

const markLoaded = () => {
  if (follows.loaded) return;
  follows = { ...follows, loaded: true };
  emit();
};

export async function loadFollows() {
  if (!isWebPushEnabled()) return markLoaded();
  const result = await requestApi<Record<string, unknown>>('/push/subscriptions', {}, { guestOnly: true });
  if (result?.status === 200 && result.data) {
    follows = normalize(result.data);
    emit();
  } else {
    markLoaded();
  }
}

// Mesma lista de IDs em qualquer ordem -> mesmo endereço (reaproveita o cache do servidor e a etiqueta)
const sortedIds = (ids: string[]) => [...ids].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).join(',');

/** /matches/following com o que a pessoa segue; null se não segue nada (a rota daria 400) */
export function followingEndpoint(state: Follows) {
  if (!state.teams.length && !state.leagues.length && !state.matches.length) return null;
  return buildEndpoint('/matches/following', {
    teams: sortedIds(state.teams),
    leagues: [...state.leagues].sort().join(','),
    matches: sortedIds(state.matches),
    // Só hoje (+ os em andamento). Explícito para funcionar também com o backend antigo (ontem a +7 dias)
    past: 0,
    days: 0,
  });
}

// Registro do navegador (Web Push). Pede permissão: só chamar depois de um toque do usuário
export const registerWebPush = () => enableWebPush(true);

async function send(method: 'POST' | 'DELETE', target: FollowTarget, extra: Record<string, unknown> = {}) {
  const request = () =>
    method === 'POST'
      ? requestApi<Record<string, unknown>>('/push/subscriptions', { method, body: JSON.stringify({ ...targetBody(target), ...extra }) }, { guestOnly: true })
      : requestApi<Record<string, unknown>>(buildEndpoint('/push/subscriptions', targetBody(target) as Record<string, string>), { method }, { guestOnly: true });
  let result = await request();
  if (result?.status === 409 && (await registerWebPush())) result = await request();
  return result;
}

function setFollowing(target: FollowTarget, following: boolean, id?: string) {
  const place = locate(target);
  const list = place?.list ?? 'matches';
  const key = id ?? place?.id;
  if (!key) return;
  const without = follows[list].filter(item => item !== key);
  follows = { ...follows, [list]: following ? [...without, key] : without };
  emit();
}

export async function toggleFollow(target: FollowTarget) {
  // Primeiro toque numa estrela: ativa as notificações neste navegador
  if (!isWebPushEnabled()) {
    const result = await enableWebPushDetailed(true);
    if (!result.ok) {
      showToast(...enableErrorMessage(result), 9000);
      return;
    }
    await loadFollows();
  }
  const following = isFollowing(follows, target);
  const before = follows;
  setFollowing(target, !following); // muda na hora
  const result = await send(following ? 'DELETE' : 'POST', target);
  if (!result || result.status >= 400) {
    follows = before; // desfaz
    emit();
    showToast('Não foi possível atualizar', 'Tente de novo em instantes.');
    return;
  }
  // Seguiu pelo ID da ESPN: a API devolve o match_id
  if (!following && target.type === 'match' && !target.matchId && result.data?.match_id && target.espnMatchId != null) {
    rememberEspnMatch(String(target.espnMatchId), String(result.data.match_id));
    setFollowing(target, true, String(result.data.match_id));
  }
}

/** Grava os tipos de aviso. Todos marcados = padrão; nenhum = deixar de seguir */
export async function saveKinds(target: FollowTarget, kinds: string[]) {
  if (!isWebPushEnabled()) return false;
  if (kinds.length === 0) {
    if (isFollowing(follows, target)) await toggleFollow(target);
    return true;
  }
  const result = await send('POST', target, { kinds });
  if (!result || result.status >= 400) {
    showToast('Não foi possível salvar os avisos', 'Tente de novo em instantes.');
    return false;
  }
  const place = locate(target);
  if (place) {
    const all = follows.availableKinds.every(kind => kinds.includes(kind));
    const byTarget = { ...follows.kinds[place.list] };
    if (all) delete byTarget[place.id];
    else byTarget[place.id] = kinds;
    follows = { ...follows, kinds: { ...follows.kinds, [place.list]: byTarget } };
    emit();
  }
  return true;
}

export function clearFollows() {
  follows = { ...EMPTY, loaded: true };
  emit();
}
