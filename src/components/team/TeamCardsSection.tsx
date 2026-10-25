'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { getLeague, getLeagueName } from '@/config/leagues';
import { CardCounts, CardPlayerName, INCOMPLETE_NOTE, SuspendedItem } from '@/components/cards/CardParts';
import { useApi } from '@/hooks/useApi';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint } from '@/lib/api';
import { hangingDetail } from '@/lib/cards';
import { formatShortDate, parseMatchDate } from '@/lib/dates';
import { getStageLabel } from '@/lib/matches';
import type { TeamCards } from '@/lib/types';

const COLLAPSED_PLAYERS = 8;

function Subtitle({ children }: { children: ReactNode }) {
  return <h4 className="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">{children}</h4>;
}

// "contra RB Bragantino (em casa, 24/10)"; em mata-mata, com a fase ("..., Semifinal")
export function nextMatchText(next: TeamCards['next_match']) {
  if (!next) return '';
  const date = formatShortDate(parseMatchDate(next.date));
  const stage = getStageLabel(next.stage);
  return `contra ${next.opponent} (${[next.home ? 'em casa' : 'fora', date, stage].filter(Boolean).join(', ')})`;
}

// Cartões do time numa competição (/team/cards): suspensos, pendurados e todos com cartão.
// Outra competição (404) ou falha: a seção não aparece
export function TeamCardsSection({ teamId, league, teamName, refreshSignal = 0 }: { teamId: string; league: string; teamName?: string; refreshSignal?: number }) {
  const { data, refresh } = useApi<TeamCards>(buildEndpoint('/team/cards', { id: teamId, league }));
  const [showAll, setShowAll] = useState(false);
  useOnSignal(refreshSignal, () => refresh({ nocache: 'true' }));

  if (!data) return null;
  const players = data.players ?? [];
  const visible = showAll ? players : players.slice(0, COLLAPSED_PLAYERS);
  const next = nextMatchText(data.next_match);

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-line bg-card-3">
      <h3 className="flex items-center gap-2.5 border-b border-line bg-card px-4 py-3">
        <span className="text-lg leading-none" aria-hidden>
          {getLeague(league)?.icon ?? '🏆'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">Cartões · {getLeagueName(league)}</span>
        <span className="text-xs text-faint">{data.season}</span>
      </h3>

      <Subtitle>Suspensos</Subtitle>
      {next && <p className="-mt-1 px-4 pb-1 text-[11px] text-faint">Fora do próximo jogo, {next}</p>}
      {data.suspended?.length ? (
        <ul>
          {data.suspended.map((p, index) => (
            <li key={`${p.espn_player_id ?? p.name}-${index}`} className="px-4 py-2">
              <SuspendedItem player={p} teamName={teamName} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-1 text-[13px] text-muted">Nenhum suspenso.</p>
      )}

      <Subtitle>Pendurados</Subtitle>
      {data.hanging?.length ? (
        <ul>
          {data.hanging.map((p, index) => (
            <li key={`${p.espn_player_id ?? p.name}-${index}`} className="px-4 py-2">
              <span className="flex items-center gap-2">
                <CardPlayerName player={p} teamName={teamName} className="flex-1 text-sm text-ink" />
                <CardCounts player={p} />
              </span>
              {hangingDetail(p) && <span className="mt-0.5 block text-right text-[11px] text-gold">{hangingDetail(p)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-1 text-[13px] text-muted">Nenhum pendurado.</p>
      )}

      {players.length > 0 && (
        <>
          <Subtitle>Todos com cartão</Subtitle>
          <ul>
            {visible.map((p, index) => (
              <li key={`${p.espn_player_id ?? p.name}-${index}`} className="flex items-center gap-2 border-t border-card-2 px-4 py-2 first:border-t-0">
                <CardPlayerName player={p} teamName={teamName} className="flex-1 text-[13px] text-ink-2" />
                <CardCounts player={p} />
              </li>
            ))}
          </ul>
          {players.length > COLLAPSED_PLAYERS && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-card-2 py-2.5 text-[13px] font-bold text-accent"
            >
              {showAll ? (
                <>
                  Mostrar menos <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Ver todos ({players.length}) <ChevronDown size={14} />
                </>
              )}
            </button>
          )}
        </>
      )}

      <div className="space-y-1 border-t border-card-2 px-4 py-2.5 text-[11px] text-faint">
        {data.rule && <p>Regra: {data.rule}</p>}
        {data.note && <p className="text-gold/90">{data.note.charAt(0).toUpperCase() + data.note.slice(1)}</p>}
        {data.matches_without_data > 0 && <p className="text-gold/90">{INCOMPLETE_NOTE}</p>}
      </div>
    </section>
  );
}
