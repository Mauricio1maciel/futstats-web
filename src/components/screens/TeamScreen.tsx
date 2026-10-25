'use client';

import { RotateCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { isCupLeague } from '@/config/leagues';
import { FollowStar } from '@/components/FollowStar';
import { getCompetitions } from '@/components/team/Competitions';
import { TeamMatchesTab } from '@/components/team/TeamMatchesTab';
import { TeamSquadTab } from '@/components/team/TeamSquadTab';
import { TeamStandingsTab } from '@/components/team/TeamStandingsTab';
import { TeamStatsTab } from '@/components/team/TeamStatsTab';
import { Crest } from '@/components/ui/Crest';
import { LazyPanel } from '@/components/ui/LazyPanel';
import { Pills, UnderlineTabs } from '@/components/ui/Pills';
import { NotFoundState } from '@/components/ui/ScreenFallback';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconButton, TopBar } from '@/components/ui/TopBar';
import { useApi } from '@/hooks/useApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOnSignal } from '@/hooks/useOnSignal';
import { useRememberedState, useScreenMemory } from '@/hooks/useScreenMemory';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { buildEndpoint } from '@/lib/api';
import { sortByDate } from '@/lib/matches';
import { getPreview } from '@/lib/preview';
import { asArray, type Match, type Team } from '@/lib/types';

// /team/matches filtra por número de rodada misturando todas as competições (o mata-mata vem com
// rodada 0). Pedindo 0..40 vem a temporada atual inteira do time numa chamada só
const TEAM_SEASON_ROUNDS = Array.from({ length: 41 }, (_, n) => n).join(',');

type MainTab = 'temporada' | 'elenco';
type SubTab = 'jogos' | 'tabela' | 'estatisticas';

export function TeamRoute() {
  const id = (useSearchParams().get('id') || '').trim();
  if (!id) return <NotFoundState />;
  return <TeamScreen key={id} id={id} />;
}

function TeamScreen({ id }: { id: string }) {
  const memory = useScreenMemory(`time:${id}`);
  const [preview] = useState(() => getPreview<Partial<Team>>('team', id));
  const [mainTab, setMainTab] = useRememberedState<MainTab>(memory, 'aba', 'temporada');
  const [subTab, setSubTab] = useRememberedState<SubTab>(memory, 'subaba', 'jogos');
  const [signals, setSignals] = useState({ jogos: 0, tabela: 0, estatisticas: 0, elenco: 0 });

  const details = useApi<Team>(buildEndpoint('/details', { api_id: id, type: 'team' }), {
    parse: raw => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Team) : ({} as Team)),
  });
  const matchesQuery = useApi(buildEndpoint('/team/matches', { id, rounds: TEAM_SEASON_ROUNDS }), {
    parse: raw => sortByDate(asArray<Match>(raw)),
  });
  useOnSignal(signals.jogos, () => matchesQuery.refresh({ nocache: 'true' }));

  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const competitions = useMemo(() => getCompetitions(matches), [matches]);
  // Liga da classificação e do elenco: a primeira de pontos corridos (ex: Brasileirão);
  // seleções e times só de copa ficam com a competição do primeiro jogo
  const mainLeague = String((matches.find(m => m.league && !isCupLeague(m.league)) || matches[0])?.league || '').toUpperCase();

  const team = details.data;
  const name = team?.name || preview?.name || '';
  const ownMatch = matches.find(m => String(m.api_home_team_id) === id || String(m.api_away_team_id) === id);
  const crest =
    team?.crest_url || preview?.crest_url || (ownMatch ? (String(ownMatch.api_home_team_id) === id ? ownMatch.home_logo : ownMatch.away_logo) : '');

  useDocumentTitle(name);
  useScrollRestoration(`time:${id}`, !matchesQuery.loading);

  const activeKey: keyof typeof signals = mainTab === 'elenco' ? 'elenco' : subTab;

  return (
    <div>
      <TopBar
        right={
          <>
            <IconButton label="Atualizar" onClick={() => setSignals(s => ({ ...s, [activeKey]: s[activeKey] + 1 }))}>
              <RotateCw size={20} />
            </IconButton>
            <FollowStar target={{ type: 'team', teamId: id }} name={name} />
          </>
        }
      />

      <div className="flex flex-col items-center px-5 pb-4">
        {crest || name ? (
          <>
            <Crest src={crest} size={60} alt={name} />
            <h1 className="mt-2 text-center text-[22px] font-bold text-white">{name || ' '}</h1>
            {details.loading && !team ? (
              <Skeleton className="mt-1.5 h-3 w-28" />
            ) : (
              <p className="mt-1 text-center text-[13px] text-muted">{team?.stadium || 'Estádio não informado'}</p>
            )}
          </>
        ) : (
          <>
            <Skeleton className="h-15 w-15 rounded-full" />
            <Skeleton className="mt-2.5 h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-28" />
          </>
        )}
      </div>

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-screen/95 backdrop-blur">
        <UnderlineTabs
          value={mainTab}
          onChange={setMainTab}
          options={[
            { value: 'temporada', label: 'TEMPORADA' },
            { value: 'elenco', label: 'ELENCO' },
          ]}
          className="px-1.5"
        />
        {mainTab === 'temporada' && (
          <Pills
            value={subTab}
            onChange={setSubTab}
            options={[
              { value: 'jogos', label: 'Jogos' },
              { value: 'tabela', label: 'Classificação' },
              { value: 'estatisticas', label: 'Estatísticas' },
            ]}
            className="px-2.5 py-3"
          />
        )}
      </div>

      <div className="px-2.5 pb-10">
        <LazyPanel active={mainTab === 'temporada' && subTab === 'jogos'}>
          <TeamMatchesTab
            teamId={id}
            matches={matches}
            competitions={competitions}
            loading={matchesQuery.loading}
            error={matchesQuery.error}
            onRetry={() => matchesQuery.refresh()}
            memory={memory}
          />
        </LazyPanel>
        <LazyPanel active={mainTab === 'temporada' && subTab === 'tabela'}>
          {matchesQuery.loading ? null : (
            <TeamStandingsTab
              teamId={id}
              teamName={name}
              competitions={competitions}
              mainLeague={mainLeague}
              active={mainTab === 'temporada' && subTab === 'tabela'}
              refreshSignal={signals.tabela}
              memory={memory}
            />
          )}
        </LazyPanel>
        <LazyPanel active={mainTab === 'temporada' && subTab === 'estatisticas'}>
          <TeamStatsTab
            teamId={id}
            teamName={name}
            refreshSignal={signals.estatisticas}
            cardLeagues={competitions.map(c => c.code)}
          />
        </LazyPanel>
        <LazyPanel active={mainTab === 'elenco'}>
          <TeamSquadTab teamId={id} league={matchesQuery.loading ? '' : mainLeague} teamName={name} refreshSignal={signals.elenco} />
        </LazyPanel>
      </div>
    </div>
  );
}
