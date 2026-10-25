'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getZoneColor, getZoneLabel, isCupLeague, ZONE_COLORS } from '@/config/leagues';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { RefreshBar } from '@/components/ui/RefreshBar';
import { ErrorState } from '@/components/ui/States';
import { useApi } from '@/hooks/useApi';
import { useOnSignal } from '@/hooks/useOnSignal';
import { buildEndpoint } from '@/lib/api';
import { shortTeamName } from '@/lib/matches';
import type { ChancesTeam, StandingsChances } from '@/lib/types';
import { Legend, StandingsSkeleton } from './StandingsTable';

// 0 -> "–"; entre 0 e 1 -> "<1%"; o resto arredondado ("62%")
export function formatChance(value: number) {
  if (!(value > 0)) return '–';
  if (value < 1) return '<1%';
  return `${Math.round(value)}%`;
}

const decimal = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// Fundo da célula mais forte quanto maior a chance, na cor da zona
const tint = (color: string, value: number) =>
  value > 0 ? { backgroundColor: `color-mix(in srgb, ${color} ${Math.round(8 + value * 0.32)}%, transparent)` } : undefined;

// Sigla da coluna ("LIB", "PRÉ"); o nome inteiro fica na legenda embaixo
const abbreviation = (label: string) => label.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();

function PositionBars({ team }: { team: ChancesTeam }) {
  const max = Math.max(...team.positions, 1);
  const likely = team.positions.indexOf(Math.max(...team.positions));
  const step = team.positions.length > 20 ? 5 : 1;
  return (
    <div className="bg-card px-4 pb-4 pt-3">
      <p className="text-xs text-muted">
        Pontos esperados: <span className="font-bold text-white">{decimal(team.expected_points)}</span>
        <span className="text-faint">
          {' '}
          (hoje {team.points} em {team.played} {team.played === 1 ? 'jogo' : 'jogos'})
        </span>
      </p>
      {likely >= 0 && team.positions[likely] > 0 && (
        <p className="mt-1 text-xs text-muted">
          Mais provável: <span className="font-bold text-white">{likely + 1}º</span> ({formatChance(team.positions[likely])})
        </p>
      )}
      <p className="mb-2 mt-3 text-[11px] text-faint">Chance de terminar em cada posição</p>
      <div className="flex h-24 items-end gap-px" role="list" aria-label="Chance de terminar em cada posição">
        {team.positions.map((value, index) => (
          <div
            key={index}
            role="listitem"
            title={`${index + 1}º: ${formatChance(value)}`}
            aria-label={`${index + 1}º: ${formatChance(value)}`}
            className={`flex-1 rounded-t-sm ${index === likely ? 'bg-accent' : 'bg-accent/50'}`}
            style={{ height: value > 0 ? `${Math.max((value / max) * 100, 3)}%` : '1px' }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-px text-center text-[9px] text-faint">
        {team.positions.map((_, index) => (
          <span key={index} className="flex-1">
            {index === 0 || (index + 1) % step === 0 ? index + 1 : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

type Props = {
  league: string;
  season?: string;
  refreshSignal?: number;
  /** A API não tem chances para esta competição (404): a tela esconde a opção */
  onUnavailable?: () => void;
};

// Chances (/standings/chances): título e cada zona por time; tocar num time mostra as posições
export function ChancesPanel({ league, season = '', refreshSignal = 0, onUnavailable }: Props) {
  const { data, loading, error, refreshing, status, refresh } = useApi<StandingsChances>(
    buildEndpoint('/standings/chances', { league, season }),
  );
  const [open, setOpen] = useState<number | null>(null);
  useOnSignal(refreshSignal, () => refresh({ nocache: 'true' }));

  const unavailable = status === 404 && !data;
  useEffect(() => {
    if (unavailable) onUnavailable?.();
  }, [unavailable, onUnavailable]);

  if (loading) return <StandingsSkeleton />;
  if (unavailable) return <p className="py-8 text-center text-sm text-muted">Chances não disponíveis para esta competição.</p>;
  if (error || !data) return <ErrorState onRetry={() => refresh()} />;
  if (!data.teams?.length) return <p className="py-8 text-center text-sm text-muted">Chances ainda não disponíveis.</p>;

  // Na fase de liga da Champions, o "título" é terminar em 1º
  const titleLabel = isCupLeague(league) ? '1º' : 'Título';
  const zones = data.zones.map(zone => ({ zone, label: getZoneLabel(league, zone), color: getZoneColor(zone) }));

  return (
    <div>
      <RefreshBar active={refreshing} />
      <div className="overflow-hidden rounded-xl bg-card-2">
        <div className="flex items-end gap-0.5 border-b border-card px-2.5 pb-2 pt-3 text-[10px] font-bold text-faint">
          <span className="w-4.5 text-center">#</span>
          <span className="min-w-0 flex-1 pl-1">Time</span>
          <span className="w-10 text-center" title={titleLabel === '1º' ? 'Terminar em 1º' : 'Título'}>
            <span className="mx-auto mb-1 block h-1 w-5 rounded-full" style={{ backgroundColor: ZONE_COLORS.qualified }} />
            {titleLabel}
          </span>
          {zones.map(z => (
            <span key={z.zone} className="w-10 text-center" title={z.label}>
              <span className="mx-auto mb-1 block h-1 w-5 rounded-full" style={{ backgroundColor: z.color }} />
              {abbreviation(z.label)}
            </span>
          ))}
          <span className="w-3" />
        </div>
        <ul>
          {data.teams.map(team => {
            const expanded = open === team.team_id;
            return (
              <li key={team.team_id} className="border-t border-card first:border-t-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : team.team_id)}
                  className="flex w-full items-center gap-0.5 px-2.5 py-2.5 text-left active:bg-white/5"
                >
                  <span className="w-4.5 text-center text-xs font-bold text-muted">{team.position}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-1">
                    <TeamCrest uri={team.crest_url} name={team.team_name} size={20} />
                    <span className="truncate text-[13px] text-ink" title={team.team_name}>
                      {shortTeamName(team.team_name)}
                    </span>
                  </span>
                  <span className="w-10 rounded py-1 text-center text-xs font-bold text-white" style={tint(ZONE_COLORS.qualified, team.title)}>
                    {formatChance(team.title)}
                  </span>
                  {zones.map(z => {
                    const value = team.zones?.[z.zone] ?? 0;
                    return (
                      <span key={z.zone} className="w-10 rounded py-1 text-center text-xs text-ink-2" style={tint(z.color, value)}>
                        {formatChance(value)}
                      </span>
                    );
                  })}
                  <ChevronDown size={14} className={`w-3 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <PositionBars team={team} />}
              </li>
            );
          })}
        </ul>
      </div>
      <Legend items={zones.map(z => ({ color: z.color, label: `${abbreviation(z.label)}: ${z.label}` }))} />
      {data.remaining_matches > 0 && (
        <p className="px-3 pb-6 text-xs text-faint">
          Simulação de {data.simulations.toLocaleString('pt-BR')} finais de campeonato com os {data.remaining_matches} jogos que faltam. As
          chances mudam a cada resultado.
        </p>
      )}
    </div>
  );
}
