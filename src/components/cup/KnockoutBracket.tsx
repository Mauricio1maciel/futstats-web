'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getBracketRounds, getLeague, type BracketSlot } from '@/config/leagues';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { RefreshBar } from '@/components/ui/RefreshBar';
import { ErrorState, InfoCard } from '@/components/ui/States';
import { useApiMany } from '@/hooks/useApiMany';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint } from '@/lib/api';
import { formatShortDate, formatTime, getMatchDate } from '@/lib/dates';
import { collapseTwoLeggedTies, hasPenalties, isFinishedMatch, isLiveMatch, sortByDate, teamDisplayName } from '@/lib/matches';
import { setMatchPreview } from '@/lib/preview';
import { matchHref } from '@/lib/routes';
import { asArray, type Match } from '@/lib/types';

const SLOTS: BracketSlot[] = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

function statusText(match: Match) {
  const date = getMatchDate(match);
  if (isLiveMatch(match)) return 'AO VIVO';
  // Confronto empatado sem decisão conhecida: não escolhe um lado
  if (isFinishedMatch(match) && match.tie_undecided) return 'Pênaltis: a definir';
  if (isFinishedMatch(match)) return `Fim • ${formatShortDate(date)}`;
  return date ? `${formatShortDate(date)} • ${formatTime(date)}` : 'A definir';
}

function TeamLine({ match, side }: { match: Match; side: 'home' | 'away' }) {
  const live = isLiveMatch(match);
  const showScore = live || isFinishedMatch(match);
  const winner = isFinishedMatch(match) && match.winner === (side === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM');
  const name = side === 'home' ? match.home_team : match.away_team;
  const score = side === 'home' ? match.home_score : match.away_score;
  const penalty = side === 'home' ? match.home_penalty : match.away_penalty;
  return (
    <div className="flex items-center py-1">
      <TeamCrest uri={side === 'home' ? match.home_logo : match.away_logo} name={name} size={18} className="mr-2" />
      <span className="flex min-w-0 flex-1 items-center">
        <span className={`truncate text-[11px] ${winner ? 'font-bold text-white' : 'text-ink-2'}`}>{teamDisplayName(name)}</span>
        {winner && <span className="ml-1 shrink-0 text-[11px] font-bold text-gold">*</span>}
      </span>
      {showScore && (
        <span className={`ml-1.5 min-w-4 text-right text-xs font-bold tabular-nums ${live ? 'text-live' : 'text-ink'}`}>
          {score}
          {hasPenalties(match) && <span className="text-gold"> ({penalty})</span>}
        </span>
      )}
    </div>
  );
}

function BracketCard({ match, league }: { match: Match | null; league: string }) {
  if (!match) return <div className="mb-3 min-h-25" />;
  const href = matchHref(match, { league });
  return (
    <Link
      href={href}
      onClick={() => setMatchPreview(match)}
      className="mb-3 flex min-h-25 flex-col justify-center rounded-2xl border border-card-2 bg-card-3 px-2.5 py-3 active:bg-white/5"
    >
      <TeamLine match={match} side="home" />
      <div className="my-1 h-px bg-card-2" />
      <TeamLine match={match} side="away" />
      <p className={`mt-1.5 text-center text-[10px] ${isLiveMatch(match) ? 'font-bold text-live' : 'text-muted'}`}>{statusText(match)}</p>
    </Link>
  );
}

// Chaveamento: Oitavas → Quartas → Semifinal → Final (no meio) → Semifinal → Quartas → Oitavas.
// O round de cada coluna vem do cadastro; com ida e volta, os dois jogos viram um card só
export function KnockoutBracket({ league, season = '', refreshSignal = 0 }: { league: string; season?: string; refreshSignal?: number }) {
  const endpoints = useMemo(() => {
    const rounds = getBracketRounds(league);
    return SLOTS.map(slot => buildEndpoint('/matches', { league, round: rounds[slot], season }));
  }, [league, season]);
  const twoLegged = !!getLeague(league)?.twoLeggedTies;
  const { data, loading, error, refreshing, refresh } = useApiMany(endpoints, raw => {
    const list = asArray<Match>(raw);
    return sortByDate(twoLegged ? collapseTwoLeggedTies(list) : list);
  });
  useOnSignal(refreshSignal, () => refresh({ nocache: 'true' }));

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden py-5" aria-hidden>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-37.5 shrink-0 space-y-3">
            <div className="h-25 animate-pulse rounded-2xl bg-line-2/50" />
            <div className="h-25 animate-pulse rounded-2xl bg-line-2/50" />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorState onRetry={() => refresh()} />;

  const [r16 = [], qf = [], sf = [], final = []] = (data ?? []).map(list => list ?? []);
  if (r16.length + qf.length + sf.length + final.length === 0) {
    return <InfoCard>O mata-mata ainda não tem confrontos definidos.</InfoCard>;
  }
  const at = (list: Match[], index: number) => list[index] ?? null;
  const columns = [
    { title: 'Oitavas', matches: [at(r16, 0), at(r16, 1), at(r16, 4), at(r16, 5)] },
    { title: 'Quartas', matches: [at(qf, 0), at(qf, 1)] },
    { title: 'Semifinal', matches: [at(sf, 0)] },
    { title: 'Final', matches: [at(final, 0)], isFinal: true },
    { title: 'Semifinal', matches: [at(sf, 1)] },
    { title: 'Quartas', matches: [at(qf, 2), at(qf, 3)] },
    { title: 'Oitavas', matches: [at(r16, 2), at(r16, 3), at(r16, 6), at(r16, 7)] },
  ];

  return (
    <div>
      <RefreshBar active={refreshing} />
      <div className="no-scrollbar -mx-2.5 overflow-x-auto px-2.5 py-5">
        <div className="flex items-start">
          {columns.map((column, index) => (
            <div key={index} className="flex items-start">
              <div className="w-37.5 shrink-0">
                <p
                  className={`mb-3 text-center text-[11px] font-bold uppercase tracking-wider ${column.isFinal ? 'text-blue-400' : 'text-muted'}`}
                >
                  {column.title}
                </p>
                <div className="flex min-h-140 flex-col justify-around py-2">
                  {column.matches.map((match, i) => (
                    <BracketCard key={`${index}-${i}`} match={match} league={league} />
                  ))}
                </div>
              </div>
              {index < columns.length - 1 && (
                <div aria-hidden className="flex w-8 shrink-0 flex-col items-center justify-between self-stretch py-3 pt-10">
                  <span className="h-0.5 w-3.5 rounded bg-line-2" />
                  <span className="w-0.5 flex-1 rounded bg-line-2" />
                  <span className="h-0.5 w-3.5 rounded bg-line-2" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
