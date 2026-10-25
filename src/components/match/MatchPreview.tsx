'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { isCupLeague, isTableStage } from '@/config/leagues';
import { HangingInline, SuspendedItem } from '@/components/cards/CardParts';
import { FormDots } from '@/components/standings/FormDots';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { Crest } from '@/components/ui/Crest';
import { formatGroupName, shortTeamName } from '@/lib/matches';
import { setPreview } from '@/lib/preview';
import { matchHref, playerHref } from '@/lib/routes';
import type { MatchPreviewData, PreviewTeam } from '@/lib/types';
import { MatchRow } from './MatchRow';

const pct = (n: number) => `${Math.round(n)}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-line bg-card-3">
      <h3 className="border-b border-line bg-card px-4 py-3 text-[15px] font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

// 1. Chances: barra em três cores e os placares mais prováveis
function Chances({ data, knockout }: { data: MatchPreviewData; knockout: boolean }) {
  const p = data.probabilities;
  if (!p || !(p.home_win + p.draw + p.away_win > 0)) return null;
  const [first, ...others] = p.likely_scores ?? [];
  const parts = [
    { label: shortTeamName(data.home.name), value: p.home_win, color: 'bg-accent', text: 'text-accent' },
    { label: 'Empate', value: p.draw, color: 'bg-faint', text: 'text-muted' },
    { label: shortTeamName(data.away.name), value: p.away_win, color: 'bg-gold', text: 'text-gold' },
  ];
  return (
    <Card title={knockout ? 'Chance de vencer o jogo' : 'Chances'}>
      <div className="px-4 pb-4 pt-3">
        <div className="flex justify-between gap-2 text-xs">
          {parts.map((part, index) => (
            <span key={part.label} className={`min-w-0 ${index === 1 ? 'text-center' : index === 2 ? 'text-right' : ''}`}>
              <span className={`block text-lg font-bold ${part.text}`}>{pct(part.value)}</span>
              <span className="block truncate text-muted">{part.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {parts.map(part => (
            <span key={part.label} className={part.color} style={{ width: `${part.value}%` }} />
          ))}
        </div>
        {first && (
          <p className="mt-3 text-[13px] text-ink-2">
            Placar mais provável:{' '}
            <span className="font-bold text-white">
              {first.home} x {first.away}
            </span>{' '}
            ({pct(first.pct)})
          </p>
        )}
        {others.length > 0 && (
          <p className="mt-1 text-xs text-faint">
            {others.map(s => `${s.home} x ${s.away} (${pct(s.pct)})`).join(' · ')}
          </p>
        )}
        {p.based_on_matches > 0 && (
          <p className="mt-2 text-[11px] text-faint">Pelo desempenho dos times em {p.based_on_matches} jogos da competição.</p>
        )}
      </div>
    </Card>
  );
}

// 2. Os dois times lado a lado: posição, pontos e forma
function TeamSide({ team, align }: { team: PreviewTeam; align: 'left' | 'right' }) {
  const right = align === 'right';
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${right ? 'items-end text-right' : 'items-start'}`}>
      <span className={`flex min-w-0 max-w-full items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <TeamCrest uri={team.crest_url} name={team.name} size={24} />
        <span className="truncate text-[13px] font-bold text-ink">{shortTeamName(team.name)}</span>
      </span>
      {!!team.position && team.position > 0 && (
        <span className="text-xs text-muted">
          <span className="font-bold text-white">{team.position}º</span>
          {team.group_name ? ` no ${formatGroupName(team.group_name)}` : ''} · {plural(team.points ?? 0, 'pt', 'pts')}
        </span>
      )}
      <FormDots form={team.form} />
    </div>
  );
}

// 3. Suspensos (com o motivo) e pendurados de cada time
function Suspensions({ data }: { data: MatchPreviewData }) {
  const teams = [data.home, data.away];
  if (!teams.some(t => t.suspended?.length || t.hanging?.length)) return null;
  return (
    <Card title="Desfalques por cartão">
      {teams.map(team => (
        <div key={team.team_id} className="border-t border-card-2 px-4 py-3 first:border-t-0">
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <TeamCrest uri={team.crest_url} name={team.name} size={18} />
            <span className="truncate">{team.name}</span>
          </p>
          {team.suspended?.length ? (
            <ul className="mt-2 space-y-1.5">
              {team.suspended.map((p, index) => (
                <li key={`${p.espn_player_id ?? p.name}-${index}`}>
                  <SuspendedItem player={p} teamName={team.name} nameClassName="text-sm text-white" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[13px] text-muted">Nenhum suspenso.</p>
          )}
          <HangingInline players={team.hanging ?? []} teamName={team.name} />
        </div>
      ))}
    </Card>
  );
}

// 4. Artilheiros de cada time na competição (até 3)
function Scorers({ data }: { data: MatchPreviewData }) {
  const teams = [data.home, data.away];
  if (!teams.some(t => t.top_scorers?.length)) return null;
  return (
    <Card title="Artilheiros na competição">
      <div className="grid grid-cols-2 divide-x divide-card-2">
        {teams.map(team => (
          <ul key={team.team_id} className="min-w-0 py-2">
            {(team.top_scorers ?? []).slice(0, 3).map(p => (
              <li key={p.player_id}>
                <Link
                  href={playerHref(p.player_id)}
                  onClick={() => setPreview('player', p.player_id, { name: p.name, team_name: team.name, headshot_url: p.headshot_url })}
                  className="flex items-center gap-2 px-3 py-1.5 active:bg-white/5"
                >
                  <Crest src={p.headshot_url} size={30} person name={p.name} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
                  <span className="shrink-0 text-xs font-bold text-white">{p.goals}</span>
                </Link>
              </li>
            ))}
            {!team.top_scorers?.length && <li className="px-3 py-1.5 text-xs text-faint">Sem gols na competição.</li>}
          </ul>
        ))}
      </div>
    </Card>
  );
}

// "7 jogos: 4 vitórias do Flamengo, 2 empates, 1 do Atlético"
export function h2hSummary(h2h: MatchPreviewData['h2h'], homeName: string, awayName: string) {
  const home = shortTeamName(homeName);
  const away = shortTeamName(awayName);
  return `${plural(h2h.played, 'jogo', 'jogos')}: ${plural(h2h.home_wins, 'vitória', 'vitórias')} do ${home}, ${plural(h2h.draws, 'empate', 'empates')}, ${h2h.away_wins} do ${away}`;
}

// 5. Confronto direto
function HeadToHeadSummary({ data, league }: { data: MatchPreviewData; league: string }) {
  const { h2h } = data;
  if (!h2h) return null;
  return (
    <Card title="Confronto direto">
      {h2h.played === 0 ? (
        <p className="px-4 py-3 text-[13px] text-muted">Primeiro confronto entre os times.</p>
      ) : (
        <>
          <p className="px-4 py-3 text-[13px] text-ink-2">{h2hSummary(h2h, data.home.name, data.away.name)}</p>
          <div className="border-t border-card-2 pt-1.5">
            {(h2h.last ?? []).map((m, index) => (
              <MatchRow key={`${m.match_id ?? m.id_event}-${index}`} match={m} href={matchHref(m, { league: m.league || league })} showDate />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// Prévia (/match/preview) na aba Detalhes, só antes do apito
export function MatchPreview({ data, league }: { data: MatchPreviewData; league: string }) {
  const stage = data.match?.stage;
  const knockout = isCupLeague(league) && !!stage && !isTableStage(stage);
  return (
    <div className="pb-2">
      <Chances data={data} knockout={knockout} />
      <Card title="Os times">
        <div className="flex gap-4 px-4 py-3">
          <TeamSide team={data.home} align="left" />
          <TeamSide team={data.away} align="right" />
        </div>
      </Card>
      <Suspensions data={data} />
      <Scorers data={data} />
      <HeadToHeadSummary data={data} league={league} />
    </div>
  );
}
