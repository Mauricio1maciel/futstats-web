'use client';

import { CardPlayerName, INCOMPLETE_NOTE, ReasonBadge, YellowCard } from '@/components/cards/CardParts';
import { nextMatchText } from '@/components/team/TeamCardsSection';
import { Crest } from '@/components/ui/Crest';
import { useApi } from '@/hooks/useApi';
import { buildEndpoint } from '@/lib/api';
import { teamDisplayName } from '@/lib/matches';
import type { Match, TeamCards } from '@/lib/types';

type Side = { cards: TeamCards; name?: string; logo?: string };

function TeamBlock({ side, dbMatchId }: { side: Side; dbMatchId?: string }) {
  const { cards } = side;
  // A suspensão vale para o próximo jogo do time; se não é este, diz qual é
  const other = cards.next_match && dbMatchId && String(cards.next_match.match_id) !== dbMatchId ? nextMatchText(cards.next_match) : '';
  return (
    <div className="border-t border-card-2 px-4 py-3 first:border-t-0">
      <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
        <Crest src={side.logo} size={18} name={side.name} />
        <span className="truncate">{teamDisplayName(side.name)}</span>
      </p>
      {cards.suspended?.length ? (
        <ul className="mt-2 space-y-1.5">
          {cards.suspended.map((p, index) => (
            <li key={`${p.espn_player_id ?? p.name}-${index}`} className="flex items-center gap-2">
              <CardPlayerName player={p} teamName={side.name} className="flex-1 text-sm text-white" />
              <ReasonBadge reason={p.reason} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted">Nenhum suspenso.</p>
      )}
      {other && cards.suspended?.length > 0 && <p className="mt-1.5 text-[11px] text-faint">Suspensão para o próximo jogo do time, {other}.</p>}
      {cards.hanging?.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <YellowCard />
          <span className="font-bold text-faint">Pendurados:</span>
          {cards.hanging.map((p, index) => (
            <span key={`${p.espn_player_id ?? p.name}-${index}`} className="inline-flex">
              <CardPlayerName player={p} teamName={side.name} />
              {index < cards.hanging.length - 1 ? ',' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// "Desfalques por cartão" na aba Detalhes de jogo não encerrado das Séries A e B (/team/cards dos
// dois times). Sem resposta dos dois (rota fora do ar, 404), o bloco não aparece
export function MatchSuspensions({ match, league, dbMatchId }: { match: Match; league: string; dbMatchId?: string }) {
  const endpoint = (id: unknown) => (id ? buildEndpoint('/team/cards', { id: String(id), league }) : null);
  const home = useApi<TeamCards>(endpoint(match.api_home_team_id));
  const away = useApi<TeamCards>(endpoint(match.api_away_team_id));

  const sides: Side[] = [];
  if (home.data) sides.push({ cards: home.data, name: match.home_team, logo: match.home_logo });
  if (away.data) sides.push({ cards: away.data, name: match.away_team, logo: match.away_logo });
  if (sides.length === 0) return null;

  return (
    <section className="mx-4 mt-5 overflow-hidden rounded-xl border border-line bg-card-3">
      <h3 className="border-b border-line bg-card px-4 py-3 text-[15px] font-bold text-ink">Desfalques por cartão</h3>
      {sides.map(side => (
        <TeamBlock key={side.name} side={side} dbMatchId={dbMatchId} />
      ))}
      {sides.some(s => s.cards.matches_without_data > 0) && <p className="border-t border-card-2 px-4 py-2.5 text-[11px] text-gold">{INCOMPLETE_NOTE}</p>}
    </section>
  );
}
