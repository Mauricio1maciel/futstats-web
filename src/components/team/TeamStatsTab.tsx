'use client';

import { BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getLeague } from '@/config/leagues';
import { TeamCardsSection } from './TeamCardsSection';
import { formatStatValue } from '@/components/match/MatchStats';
import { Crest } from '@/components/ui/Crest';
import { RefreshBar } from '@/components/ui/RefreshBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useApi } from '@/hooks/useApi';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint } from '@/lib/api';
import { formatFullDate, parseMatchDate } from '@/lib/dates';
import { setPreview } from '@/lib/preview';
import { matchHref, playerHref } from '@/lib/routes';
import type { MatchRef, RecordSplit, TeamCompetitionStats, TeamStats } from '@/lib/types';

function Subtitle({ children }: { children: ReactNode }) {
  return <h4 className="px-4 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">{children}</h4>;
}

// Campanha: geral, em casa e fora
function Record({ stats }: { stats: TeamCompetitionStats }) {
  const rows: [string, RecordSplit][] = [
    ['Geral', stats],
    ['Em casa', stats.home],
    ['Fora', stats.away],
  ];
  const col = 'w-8 shrink-0 text-center';
  return (
    <div className="px-4">
      <div className="flex border-b border-card-2 pb-1.5 text-[11px] text-faint">
        <span className="flex-1" />
        <span className={col}>J</span>
        <span className={col}>V</span>
        <span className={col}>E</span>
        <span className={col}>D</span>
        <span className="w-14 shrink-0 text-center">Gols</span>
      </div>
      {rows.map(([label, r]) => (
        <div key={label} className="flex items-center border-b border-card-2 py-2 text-sm last:border-b-0">
          <span className="flex-1 text-ink-2">{label}</span>
          <span className={`${col} font-bold text-white`}>{r?.played ?? 0}</span>
          <span className={`${col} text-win`}>{r?.wins ?? 0}</span>
          <span className={`${col} text-muted`}>{r?.draws ?? 0}</span>
          <span className={`${col} text-loss`}>{r?.losses ?? 0}</span>
          <span className="w-14 shrink-0 text-center tabular-nums text-ink-2">
            {r?.goals_for ?? 0}:{r?.goals_against ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
}

function BigResult({ label, match, league, tone }: { label: string; match: MatchRef | null; league: string; tone: 'win' | 'loss' }) {
  if (!match) return null;
  const href = matchHref({ id_event: match.espn_match_id, match_id: match.match_id, league, date_event: match.date });
  return (
    <Link href={href} className="flex items-center gap-3 border-t border-card-2 px-4 py-3 active:bg-white/5">
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold ${tone === 'win' ? 'text-win' : 'text-loss'}`}>{label}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink">
          {match.home_team} <span className="font-bold text-white">{match.home_score} x {match.away_score}</span> {match.away_team}
        </span>
        <span className="block text-[11px] text-faint">{formatFullDate(parseMatchDate(match.date))}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  );
}

function Averages({ stats }: { stats: TeamCompetitionStats }) {
  const a = stats.averages;
  if (!a) return null;
  const items: [string, string][] = [
    ['Posse de bola', formatStatValue(a.possession, '%')],
    ['Finalizações', formatStatValue(a.shots)],
    ['Finalizações no gol', formatStatValue(a.shots_on_target)],
    ['Escanteios', formatStatValue(a.corners)],
    ['Faltas', formatStatValue(a.fouls)],
    ['Cartões amarelos', formatStatValue(a.yellow_cards)],
    ['Cartões vermelhos', formatStatValue(a.red_cards)],
    ['Precisão dos passes', formatStatValue(a.pass_accuracy, '%')],
  ];
  return (
    <>
      <Subtitle>
        Médias por jogo <span className="font-normal normal-case tracking-normal">({a.matches} {a.matches === 1 ? 'jogo' : 'jogos'} com estatísticas)</span>
      </Subtitle>
      <div className="grid grid-cols-2 gap-px bg-card-2">
        {items.map(([label, value]) => (
          <div key={label} className="bg-card-3 px-4 py-2.5">
            <p className="text-base font-bold text-white">{value}</p>
            <p className="text-[11px] text-muted">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function CompetitionBlock({ stats }: { stats: TeamCompetitionStats }) {
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-line bg-card-3">
      <h3 className="flex items-center gap-2.5 border-b border-line bg-card px-4 py-3">
        <span className="text-lg leading-none" aria-hidden>
          {getLeague(stats.league)?.icon ?? '🏆'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{stats.league_name}</span>
        <span className="text-xs text-faint">{stats.season}</span>
      </h3>

      <Subtitle>Campanha</Subtitle>
      <Record stats={stats} />

      <Subtitle>Destaques</Subtitle>
      <div className="grid grid-cols-2 gap-px bg-card-2">
        <div className="bg-card-3 px-4 py-2.5">
          <p className="text-base font-bold text-white">{stats.clean_sheets}</p>
          <p className="text-[11px] text-muted">Jogos sem sofrer gol</p>
        </div>
        <div className="bg-card-3 px-4 py-2.5">
          <p className="text-base font-bold text-white">{stats.failed_to_score}</p>
          <p className="text-[11px] text-muted">Jogos sem marcar</p>
        </div>
      </div>
      <BigResult label="Maior vitória" match={stats.biggest_win} league={stats.league} tone="win" />
      <BigResult label="Maior derrota" match={stats.biggest_loss} league={stats.league} tone="loss" />

      <Averages stats={stats} />

      {stats.top_scorers?.length > 0 && (
        <>
          <Subtitle>Artilheiros</Subtitle>
          <ul className="pb-1">
            {stats.top_scorers.slice(0, 5).map((p, index) => (
              <li key={`${p.player_id}-${index}`}>
                <Link
                  href={playerHref(p.player_id)}
                  onClick={() => setPreview('player', p.player_id, { name: p.name, headshot_url: p.headshot_url })}
                  className="flex items-center gap-3 px-4 py-2 active:bg-white/5"
                >
                  <span className="w-4 text-center text-xs font-bold text-faint">{index + 1}</span>
                  <Crest src={p.headshot_url} size={34} person name={p.name} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                  <span className="rounded-lg bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
                    {p.goals} {p.goals === 1 ? 'gol' : 'gols'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type Props = {
  teamId: string;
  refreshSignal: number;
  /** Competições do time: uma seção "Cartões" para cada (a que não tiver regra dá 404 e some) */
  cardLeagues?: string[];
  teamName?: string;
};

// Estatísticas do time na temporada (/team/stats), um bloco por competição, e os cartões
// (pendurados e suspensos) nas competições que têm
export function TeamStatsTab({ teamId, refreshSignal, cardLeagues = [], teamName }: Props) {
  return (
    <>
      {cardLeagues.map(league => (
        <TeamCardsSection key={league} teamId={teamId} league={league} teamName={teamName} refreshSignal={refreshSignal} />
      ))}
      <TeamSeasonStats teamId={teamId} refreshSignal={refreshSignal} />
    </>
  );
}

function TeamSeasonStats({ teamId, refreshSignal }: { teamId: string; refreshSignal: number }) {
  const { data, loading, error, refreshing, refresh } = useApi<TeamStats>(buildEndpoint('/team/stats', { id: teamId }));
  useOnSignal(refreshSignal, () => refresh({ nocache: 'true' }));

  if (loading) {
    return (
      <div className="space-y-3 pt-1" aria-label="Carregando estatísticas">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <ErrorState text="Não foi possível carregar as estatísticas" onRetry={() => refresh()} />;
  if (!data.competitions?.length) return <EmptyState compact icon={BarChart3} text="Sem estatísticas nesta temporada" />;

  return (
    <div className="pt-1">
      <RefreshBar active={refreshing} />
      {data.competitions.map((stats, index) => (
        <CompetitionBlock key={`${stats.league}-${stats.season}-${index}`} stats={stats} />
      ))}
    </div>
  );
}
