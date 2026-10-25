'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatShortDate, formatTime, getMatchDate } from '@/lib/dates';
import type { LiveClockData } from '@/lib/liveClock';
import { getEspnMatchId, getSpecialStatusLabel, isFinishedMatch, isLiveMatch, teamDisplayName } from '@/lib/matches';
import { setPreview } from '@/lib/preview';
import { teamHref } from '@/lib/routes';
import type { Match } from '@/lib/types';
import { LiveClock } from './LiveClock';
import { Score } from './Score';

function TeamColumn({ name, logo, teamId }: { name?: string; logo?: string; teamId?: unknown }) {
  const content = (
    <>
      <TeamCrest uri={logo} name={name} size={50} className="mb-2.5" />
      <span className="line-clamp-2 text-center text-[13px] font-bold leading-tight text-white">{teamDisplayName(name)}</span>
    </>
  );
  const valid = teamId != null && Number(teamId) > 0;
  if (!valid) return <div className="flex min-w-0 flex-1 flex-col items-center">{content}</div>;
  return (
    <Link
      href={teamHref(teamId)}
      onClick={() => setPreview('team', teamId, { name, crest_url: logo })}
      className="flex min-w-0 flex-1 flex-col items-center rounded-lg py-1 active:bg-white/5"
    >
      {content}
    </Link>
  );
}

// Placar do topo: escudos e nomes (tocar abre o time), status com o minuto e o placar com pênaltis
export function MatchHeader({ match, clock }: { match: Match | null; clock: LiveClockData }) {
  if (!match) {
    return (
      <div className="flex items-center bg-card px-2.5 py-5" aria-hidden>
        {[0, 1, 2].map(i =>
          i === 1 ? (
            <div key={i} className="flex w-28 flex-col items-center gap-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ) : (
            <div key={i} className="flex flex-1 flex-col items-center gap-2.5">
              <Skeleton className="h-12.5 w-12.5 rounded-full" />
              <Skeleton className="h-3 w-18" />
            </div>
          ),
        )}
      </div>
    );
  }

  const live = isLiveMatch(match);
  const finished = isFinishedMatch(match);
  const special = getSpecialStatusLabel(match);
  const date = getMatchDate(match);

  let center: ReactNode;
  if (live || finished) {
    center = (
      <>
        <span className={`text-[11px] font-bold ${live ? 'text-live' : 'text-muted'}`}>{live ? 'Ao Vivo' : 'Encerrado'}</span>
        {live && <LiveClock match={clock} matchId={getEspnMatchId(match)} className="text-[13px] font-bold text-live" />}
        <Score match={match} className="mt-0.5 text-[32px] leading-none text-white" penaltyClassName="text-lg" />
      </>
    );
  } else {
    center = (
      <>
        <span className="text-[11px] font-bold text-muted">{special || 'Agendado'}</span>
        <span className="mt-1 text-[26px] font-bold leading-none text-white">{formatTime(date) || '--:--'}</span>
        {date && <span className="mt-1.5 text-xs text-muted">{formatShortDate(date)}</span>}
      </>
    );
  }

  return (
    <div className="flex items-center bg-card px-2.5 py-5">
      <TeamColumn name={match.home_team} logo={match.home_logo} teamId={match.api_home_team_id} />
      <div className="flex w-28 shrink-0 flex-col items-center">{center}</div>
      <TeamColumn name={match.away_team} logo={match.away_logo} teamId={match.api_away_team_id} />
    </div>
  );
}
