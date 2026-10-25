'use client';

import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ResultBadge } from '@/components/match/MatchRow';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useApi } from '@/hooks/useApi';
import { buildEndpoint } from '@/lib/api';
import { formatShortDate, parseMatchDate } from '@/lib/dates';
import { matchHref, teamHref } from '@/lib/routes';
import type { PlayerMatchLine, PlayerStats, PlayerTotals } from '@/lib/types';

const num = (n: number) => n.toLocaleString('pt-BR');

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="mx-4 mt-5 overflow-hidden rounded-xl border border-card-2 bg-card-3">
      <h2 className="border-b border-card-2 px-4 py-3 text-[15px] font-bold text-ink">{title}</h2>
      {children}
      {note && <p className="border-t border-card-2 px-4 py-2.5 text-[11px] text-faint">{note}</p>}
    </section>
  );
}

function Cards({ yellow, red }: { yellow: number; red: number }) {
  if (!yellow && !red) return <span className="text-faint">0</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {yellow > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <span className="h-3 w-2 rounded-xs bg-gold" aria-label="Cartões amarelos" />
          {yellow}
        </span>
      )}
      {red > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <span className="h-3 w-2 rounded-xs bg-live" aria-label="Cartões vermelhos" />
          {red}
        </span>
      )}
    </span>
  );
}

function CurrentSeason({ current }: { current: PlayerTotals }) {
  const withAssists = current.assists != null;
  const items = [
    { label: 'Jogos', value: num(current.appearances), sub: `${current.starts} titular` },
    // "16 gols (3 de pênalti)"
    { label: 'Gols', value: num(current.goals), sub: current.penalties > 0 ? `(${current.penalties} de pênalti)` : '' },
    ...(withAssists ? [{ label: 'Assist.', value: num(current.assists ?? 0), sub: '' }] : []),
    { label: 'Minutos', value: num(current.minutes), sub: '' },
  ];
  return (
    <div className={`grid ${withAssists ? 'grid-cols-5' : 'grid-cols-4'} divide-x divide-card-2 py-4 text-center`}>
      {items.map(item => (
        <div key={item.label} className="px-1">
          <p className="text-lg font-bold text-white">{item.value}</p>
          <p className="mt-0.5 text-xs text-muted">{item.label}</p>
          {item.sub && <p className="mt-0.5 text-[10px] text-faint">{item.sub}</p>}
        </div>
      ))}
      <div className="px-1">
        <p className="flex h-7 items-center justify-center text-base font-bold text-white">
          <Cards yellow={current.yellow_cards} red={current.red_cards} />
        </p>
        <p className="mt-0.5 text-xs text-muted">Cartões</p>
      </div>
    </div>
  );
}

// O que ele fez no jogo: ⚽ gols, cartões, entrou/saiu e os minutos
function MatchActions({ line }: { line: PlayerMatchLine }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs text-muted">
      {line.goals > 0 && (
        <span title={line.penalties ? `${line.penalties} de pênalti` : undefined}>
          ⚽{line.goals > 1 ? `×${line.goals}` : ''}
          {line.penalties > 0 && <span className="text-faint"> (pên.)</span>}
        </span>
      )}
      {!!line.assists && line.assists > 0 && (
        <span title="Assistências">👟{line.assists > 1 ? `×${line.assists}` : ''}</span>
      )}
      {line.own_goals > 0 && <span>⚽ contra{line.own_goals > 1 ? ` ×${line.own_goals}` : ''}</span>}
      {line.yellow_cards > 0 && <span className="h-3 w-2 rounded-xs bg-gold" aria-label="Cartão amarelo" />}
      {line.red_cards > 0 && <span className="h-3 w-2 rounded-xs bg-live" aria-label="Cartão vermelho" />}
      {line.subbed_in && (
        <span className="inline-flex items-center text-win">
          <ArrowUp size={12} strokeWidth={3} />
          {line.subbed_in}
        </span>
      )}
      {line.subbed_out && (
        <span className="inline-flex items-center text-live">
          <ArrowDown size={12} strokeWidth={3} />
          {line.subbed_out}
        </span>
      )}
      <span>{line.minutes} min</span>
    </span>
  );
}

function LastMatchRow({ line }: { line: PlayerMatchLine }) {
  const result = line.result === 'V' || line.result === 'E' || line.result === 'D' ? line.result : null;
  const href = matchHref({ id_event: String(line.espn_match_id), league: line.league, date_event: line.date });
  return (
    <li className="border-t border-card-2 first:border-t-0">
      <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-white/5">
        <span className="w-10 shrink-0 text-xs text-muted">{formatShortDate(parseMatchDate(line.date))}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[11px] text-faint">{line.home ? 'vs' : 'em'}</span>
            <TeamCrest uri={line.opponent.crest_url} name={line.opponent.name} size={18} />
            <span className="truncate text-[13px] text-ink">{line.opponent.name}</span>
          </span>
          <MatchActions line={line} />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-white">
            {line.goals_for} x {line.goals_against}
          </span>
          {result && <ResultBadge result={result} />}
        </span>
      </Link>
    </li>
  );
}

// Estatísticas do jogador (/player/stats): temporada atual, por competição e últimos jogos
export function PlayerStatsSection({ playerId }: { playerId: string }) {
  const { data, loading, error, refresh } = useApi<PlayerStats>(buildEndpoint('/player/stats', { id: playerId }));

  if (loading) {
    return (
      <div className="mx-4 mt-5 space-y-3" aria-label="Carregando estatísticas">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <ErrorState text="Não foi possível carregar as estatísticas" onRetry={() => refresh()} />;
  if (!data.competitions?.length) {
    return <EmptyState compact icon={BarChart3} text="Sem estatísticas nesta temporada" />;
  }
  const hasAssists = data.current.assists != null;

  return (
    <div className="pb-4">
      <Card
        title="Temporada atual"
        note={data.current.assists != null ? 'Minutos aproximados.' : 'Minutos aproximados. Assistências não disponíveis.'}
      >
        <CurrentSeason current={data.current} />
      </Card>

      <Card title="Por competição">
        <div className="flex px-4 pb-1 pt-2.5 text-[11px] text-faint">
          <span className="flex-1">Competição / time</span>
          <span className="w-7 text-center">J</span>
          <span className="w-7 text-center">G</span>
          {hasAssists && <span className="w-7 text-center">A</span>}
          <span className="w-11 text-center">Cart.</span>
        </div>
        <ul>
          {data.competitions.map((c, index) => (
            <li key={`${c.league}-${c.season}-${c.team.id}-${index}`} className="flex items-center gap-1 border-t border-card-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{c.league_name}</span>
                {Number(c.team.id) > 0 ? (
                  <Link href={teamHref(c.team.id)} className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <TeamCrest uri={c.team.crest_url} name={c.team.name} size={14} />
                    <span className="truncate">{c.team.name}</span>
                    <span className="shrink-0 text-faint">· {c.season}</span>
                  </Link>
                ) : (
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {c.team.name} · {c.season}
                  </span>
                )}
              </span>
              <span className="w-7 text-center text-sm text-ink-2">{c.appearances}</span>
              <span className="w-7 text-center text-sm font-bold text-white">{c.goals}</span>
              {hasAssists && <span className="w-7 text-center text-sm text-ink-2">{c.assists ?? 0}</span>}
              <span className="flex w-11 justify-center text-xs text-ink-2">
                <Cards yellow={c.yellow_cards} red={c.red_cards} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {data.last_matches?.length > 0 && (
        <Card title="Últimos jogos">
          <ul>
            {data.last_matches.map((line, index) => (
              <LastMatchRow key={`${line.espn_match_id}-${index}`} line={line} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
