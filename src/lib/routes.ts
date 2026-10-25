// Endereços das telas. O site é estático, então o ID vai na query string (/jogo/?id=...):
// funciona em qualquer hospedagem sem regra de reescrita (veja o README)
import { getEspnMatchId } from './matches';
import type { Match } from './types';

type Params = Record<string, unknown>;

function href(path: string, params: Params) {
  const query = Object.entries(params)
    .filter(([, value]) => value != null && String(value) !== '' && String(value) !== '0')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

export const homeHref = () => '/';

export const leagueHref = (code: unknown) => href('/liga/', { codigo: String(code || '').toUpperCase() });

export const teamHref = (apiId: unknown) => href('/time/', { id: apiId });

export const playerHref = (id: unknown) => href('/jogador/', { id });

export const searchHref = (q?: string) => href('/busca/', { q });

// Rota do jogo: ID da ESPN (abre /match/history); jogo futuro sem vínculo abre pelo match_id do banco.
// O match_id vai junto (seguir o jogo), e o minuto da lista (o /match/history não traz), com o
// relógio que anda sozinho (clock_seconds lido em clock_at) quando o /matches/live manda
export function matchHref(m: Match, options: { league?: string; dbMatchId?: unknown } = {}) {
  const dbMatchId = options.dbMatchId !== undefined ? options.dbMatchId : m.match_id;
  return href('/jogo/', {
    id: getEspnMatchId(m) || dbMatchId,
    league: options.league || m.league,
    date: m.date_event || m.match_date,
    espn_home: m.espn_home_team_id,
    espn_away: m.espn_away_team_id,
    api_home: m.api_home_team_id,
    api_away: m.api_away_team_id,
    match_id: dbMatchId,
    clock: m.clock && m.clock !== 'pre' ? m.clock : '',
    clock_seconds: m.clock_at ? m.clock_seconds : undefined,
    clock_at: m.clock_at,
    clock_running: m.clock_at ? (m.clock_running ? '1' : '0') : undefined,
    period: m.clock_at ? m.period : undefined,
    clock_est: m.clock_at && m.clock_estimated ? '1' : undefined,
  });
}
