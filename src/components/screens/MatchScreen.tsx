'use client';

import { RotateCw, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLeagueName, getTableLabel, hasStandingsTable, isCupLeague } from '@/config/leagues';
import { FollowStar } from '@/components/FollowStar';
import { HeadToHead } from '@/components/match/HeadToHead';
import { MatchCommentary } from '@/components/match/MatchCommentary';
import { MatchHeader } from '@/components/match/MatchHeader';
import { MatchLineups } from '@/components/match/MatchLineups';
import { MatchStats } from '@/components/match/MatchStats';
import { MatchPreview } from '@/components/match/MatchPreview';
import { MatchVideos } from '@/components/match/MatchVideos';
import { MatchTimeline } from '@/components/match/MatchTimeline';
import { StandingsSection } from '@/components/standings/StandingsSection';
import { LazyPanel } from '@/components/ui/LazyPanel';
import { UnderlineTabs } from '@/components/ui/Pills';
import { RefreshBar } from '@/components/ui/RefreshBar';
import { NotFoundState } from '@/components/ui/ScreenFallback';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { IconButton, TopBar } from '@/components/ui/TopBar';
import { useApi } from '@/hooks/useApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useInterval } from '@/hooks/useInterval';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useRememberedState, useScreenMemory } from '@/hooks/useScreenMemory';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { buildEndpoint, fetchApi, refreshParams, withParams } from '@/lib/api';
import { parseMatchDate, toDateKey } from '@/lib/dates';
import { pickClock, type LiveClockData } from '@/lib/liveClock';
import { getEspnMatchId, getPhaseLabel, hasPenalties, isFinishedMatch, isLiveMatch } from '@/lib/matches';
import { getPreview } from '@/lib/preview';
import { asArray, type Match, type MatchHistory, type MatchPreviewData, type MatchVideo } from '@/lib/types';

const LIVE_REFRESH_MS = 30000;
const VIDEOS_REFRESH_MS = 5 * 60 * 1000;

type Tab = 'detalhes' | 'videos' | 'lances' | 'estatisticas' | 'escalacao' | 'confronto' | 'tabela';

type RouteParams = {
  id: string;
  league: string;
  date: string;
  espnHome: string;
  espnAway: string;
  apiHome: string;
  apiAway: string;
  dbMatchId: string;
  clock: LiveClockData;
};

// /jogo/?id=<ID da ESPN ou match_id>&league=&date=&espn_home=&espn_away=&match_id=&clock=
// (+ clock_seconds, clock_at, clock_running e period: o relógio que anda sozinho)
export function MatchRoute() {
  const query = useSearchParams();
  const get = (key: string) => query.get(key) || '';
  const params: RouteParams = {
    id: get('id'),
    league: get('league').toUpperCase(),
    date: get('date'),
    espnHome: get('espn_home'),
    espnAway: get('espn_away'),
    apiHome: get('api_home'),
    apiAway: get('api_away'),
    dbMatchId: get('match_id'),
    clock: {
      clock: get('clock'),
      clock_seconds: get('clock_seconds') ? Number(get('clock_seconds')) : undefined,
      clock_at: get('clock_at') || undefined,
      clock_running: get('clock_running') === '1',
      period: get('period') ? Number(get('period')) : undefined,
    },
  };
  if (!params.id) return <NotFoundState />;
  return <MatchScreen key={`${params.id}-${params.league}`} {...params} />;
}

// Junta objetos ignorando valores vazios (o history manda "" em campos que a lista já tinha)
function mergeDefined<T extends object>(...parts: (Partial<T> | null | undefined)[]): T {
  const out: Record<string, unknown> = {};
  parts.forEach(part => {
    if (!part) return;
    Object.entries(part).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') out[key] = value;
    });
  });
  return out as T;
}

function normalizeHistory(raw: MatchHistory): MatchHistory {
  return {
    match: raw.match ?? null,
    lineups: asArray(raw.lineups),
    events: asArray(raw.events),
    statistics: asArray(raw.statistics),
  };
}

// Resposta nova com escalação/eventos/estatísticas vazios não apaga o que já está na tela
function mergeHistory(prev: MatchHistory | null, next: MatchHistory): MatchHistory {
  const fresh = normalizeHistory(next);
  if (!prev) return fresh;
  return {
    match: fresh.match ? { ...prev.match, ...fresh.match } : prev.match,
    lineups: fresh.lineups.length ? fresh.lineups : prev.lineups,
    events: fresh.events.length ? fresh.events : prev.events,
    statistics: fresh.statistics.length ? fresh.statistics : prev.statistics,
  };
}

function MatchScreen(params: RouteParams) {
  const { id, league } = params;
  const isAdmin = useIsAdmin();
  const memory = useScreenMemory(`jogo:${id}`);
  const [preview] = useState(() => getPreview<Match>('match', id));

  const [history, setHistory] = useState<MatchHistory | null>(null);
  const [fallback, setFallback] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Placar/minuto/status do /matches/live (o history não traz o minuto)
  const [liveInfo, setLiveInfo] = useState<Partial<Match> | null>(null);
  const [clock, setClock] = useState<LiveClockData>(() => (params.clock.clock ? params.clock : pickClock(preview)));
  const [tab, setTab] = useRememberedState<Tab>(memory, 'aba', 'detalhes');
  const [side, setSide] = useRememberedState<'home' | 'away'>(memory, 'time', 'home');
  const [standingsSignal, setStandingsSignal] = useState(0);
  const [commentarySignal, setCommentarySignal] = useState(0);
  // Lance a lance: só com o ID da ESPN; some se a rota responder 404
  const [commentaryOff, setCommentaryOff] = useState(false);
  const hideCommentary = useCallback(() => setCommentaryOff(true), []);
  const hasEspnId = !(params.dbMatchId && id === params.dbMatchId);

  const historyEndpoint = buildEndpoint('/match/history', { id, league });

  const applyHistory = useCallback((data: MatchHistory) => setHistory(prev => mergeHistory(prev, data)), []);

  // O que se sabe do jogo: endereço < lista anterior < jogo achado no dia < history < ao vivo
  const match = useMemo<Match | null>(() => {
    const known = preview || fallback || history?.match;
    if (!known) return null;
    return mergeDefined<Match>(
      {
        league,
        date_event: params.date,
        espn_home_team_id: params.espnHome,
        espn_away_team_id: params.espnAway,
        api_home_team_id: params.apiHome,
        api_away_team_id: params.apiAway,
        match_id: params.dbMatchId,
      },
      preview,
      fallback,
      history?.match,
      liveInfo,
    );
  }, [preview, fallback, history, liveInfo, league, params.date, params.espnHome, params.espnAway, params.apiHome, params.apiAway, params.dbMatchId]);

  const live = isLiveMatch(match);
  const finished = isFinishedMatch(match);
  const started = live || finished;

  // Prévia (/match/preview) na aba Detalhes, só antes do apito: pelo ID do banco, ou o da ESPN
  const previewEndpoint =
    match && !started ? buildEndpoint('/match/preview', params.dbMatchId ? { match_id: params.dbMatchId } : { id }) : null;
  const previewQuery = useApi<MatchPreviewData>(previewEndpoint);
  const matchPreview = !started && previewQuery.data?.home && previewQuery.data?.away ? previewQuery.data : null;

  // Vídeos (/match/videos): antes do jogo vêm vazios. Busca ao abrir e, com a tela aberta, a cada
  // 5 min (chegam vídeos novos durante o jogo e nas horas seguintes). A aba só aparece com vídeo
  const videosQuery = useApi(hasEspnId && started ? buildEndpoint('/match/videos', { id }) : null, {
    parse: raw => asArray<MatchVideo>(raw),
  });
  const videos = videosQuery.data ?? [];
  useInterval(() => videosQuery.refresh(), hasEspnId && started ? VIDEOS_REFRESH_MS : null);

  // Abertura: history (cópia local na hora). Sem history (jogo sem vínculo com a ESPN, 404),
  // procura o jogo na lista do dia para mostrar ao menos os times e o horário
  useEffect(() => {
    let cancelled = false;
    let hadCache = false;
    // A rota usa o match_id quando o jogo ainda não tem ID da ESPN: aí o /match/history daria 404
    const withoutEspnId = !!params.dbMatchId && id === params.dbMatchId;
    (async () => {
      const data = withoutEspnId
        ? null
        : await fetchApi<MatchHistory>(historyEndpoint, {}, {
            onCached: cached => {
              if (cancelled || !cached?.match) return;
              hadCache = true;
              applyHistory(cached);
              setLoading(false);
            },
          });
      if (cancelled) return;
      if (data?.match) {
        applyHistory(data);
        setLoading(false);
        return;
      }
      const date = parseMatchDate(params.date);
      if (date) {
        const day = await fetchApi(buildEndpoint('/matches', { league, date: toDateKey(date) }));
        const found = asArray<Match>(day).find(
          m => (params.dbMatchId && String(m.match_id) === params.dbMatchId) || String(m.match_id) === id || getEspnMatchId(m) === id,
        );
        if (cancelled) return;
        if (found) setFallback(found);
        else if (!preview && !hadCache) setNotFound(true);
      } else if (!preview && !hadCache) {
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [historyEndpoint, applyHistory, id, league, preview, params.date, params.espnHome, params.espnAway, params.dbMatchId]);

  // Ao vivo: placar, minuto e status do /matches/live (lá o match_id é o ID da ESPN)
  const fetchLive = useCallback(async () => {
    const list = asArray<Match>(await fetchApi(buildEndpoint('/matches/live', { league })));
    const found = list.find(m => String(m.match_id) === id || getEspnMatchId(m) === id);
    if (!found) return;
    setLiveInfo({
      home_score: found.home_score,
      away_score: found.away_score,
      status: found.state || found.status,
      // Disputa de pênaltis: o parcial vem durante a disputa
      ...(hasPenalties(found) ? { home_penalty: found.home_penalty, away_penalty: found.away_penalty } : {}),
    });
    // Minuto vazio na resposta não apaga o que está na tela
    if (found.clock && found.clock !== 'pre') setClock(pickClock(found));
  }, [league, id]);

  // Logo ao abrir (o minuto aparece na hora) e depois a cada 30 s, em paralelo com o history
  useEffect(() => {
    if (live) fetchLive();
  }, [live, fetchLive]);

  useInterval(
    async () => {
      const [, fresh] = await Promise.all([fetchLive(), fetchApi<MatchHistory>(historyEndpoint)]);
      if (fresh?.match) {
        applyHistory(fresh);
        if (isFinishedMatch(fresh.match)) setLiveInfo(null);
      }
    },
    live ? LIVE_REFRESH_MS : null,
  );

  // Atualizar: com admin logado, force_update=true busca escalação e eventos na ESPN
  const refresh = async () => {
    setRefreshing(true);
    const data = await fetchApi<MatchHistory>(withParams(historyEndpoint, refreshParams(isAdmin, 'force_update')));
    if (data?.match) {
      applyHistory(data);
      if (isFinishedMatch(data.match)) setLiveInfo(null);
    }
    if (live) await fetchLive();
    if (tab === 'tabela') setStandingsSignal(n => n + 1);
    if (tab === 'lances') setCommentarySignal(n => n + 1);
    if (started && hasEspnId) videosQuery.refresh();
    if (!started) previewQuery.refresh({ nocache: 'true' });
    setRefreshing(false);
  };

  const homeName = match?.home_team;
  const awayName = match?.away_team;
  useDocumentTitle(homeName && awayName ? `${homeName} x ${awayName}` : null);
  useScrollRestoration(`jogo:${id}`, !loading);

  if (notFound && !match) {
    return (
      <div>
        <TopBar />
        <EmptyState
          icon={SearchX}
          title="Jogo não encontrado"
          text="Os detalhes deste jogo ainda não estão disponíveis."
          action={
            <Link href="/" className="text-sm font-bold text-accent">
              Ir para o início
            </Link>
          }
        />
      </div>
    );
  }

  const hasStandings = hasStandingsTable(league);
  const tabs: { value: Tab; label: string }[] = [
    { value: 'detalhes', label: 'Detalhes' },
    ...(videos.length > 0 ? [{ value: 'videos' as const, label: 'Vídeos' }] : []),
    ...(hasEspnId && !commentaryOff ? [{ value: 'lances' as const, label: 'Lance a lance' }] : []),
    { value: 'estatisticas', label: 'Estatísticas' },
    { value: 'escalacao', label: 'Escalação' },
    { value: 'confronto', label: 'Confronto' },
    ...(hasStandings ? [{ value: 'tabela' as const, label: isCupLeague(league) ? getTableLabel(league) : 'Classificação' }] : []),
  ];
  const activeTab = tabs.some(t => t.value === tab) ? tab : 'detalhes';
  const phase = preview || fallback ? getPhaseLabel(mergeDefined<Match>({ league }, preview, fallback)) : '';
  const waiting = loading && !history;

  return (
    <div>
      <TopBar
        title={
          <span className="block min-w-0">
            <span className="block truncate text-[15px]">{getLeagueName(league, match?.league_name)}</span>
            {phase && <span className="block truncate text-xs font-normal text-muted">{phase}</span>}
          </span>
        }
        right={
          <>
            {!finished && (
              <FollowStar
                target={{
                  type: 'match',
                  matchId: params.dbMatchId || undefined,
                  // A rota usa o ID da ESPN (quando difere do match_id); o history não traz id_event
                  espnMatchId: id !== params.dbMatchId ? id : getEspnMatchId(match) || undefined,
                }} name={`${homeName} x ${awayName}`} />
            )}
            <IconButton label="Atualizar" onClick={refresh} disabled={refreshing}>
              <RotateCw size={20} className={refreshing ? 'animate-spin text-accent' : ''} />
            </IconButton>
          </>
        }
      />

      <MatchHeader match={match} clock={clock} />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-card">
        <UnderlineTabs value={activeTab} onChange={setTab} options={tabs} />
        <RefreshBar active={refreshing} />
      </div>

      <div className="pb-10">
        {activeTab === 'detalhes' &&
          (matchPreview ? (
            <MatchPreview data={matchPreview} league={league} />
          ) : waiting || (!started && previewQuery.loading) ? (
            <TimelineSkeleton />
          ) : (
            <MatchTimeline events={history?.events ?? []} homeEspnId={match?.espn_home_team_id} />
          ))}

        {videos.length > 0 && (
          <LazyPanel active={activeTab === 'videos'}>
            <MatchVideos videos={videos} />
          </LazyPanel>
        )}

        {hasEspnId && !commentaryOff && (
          <LazyPanel active={activeTab === 'lances'}>
            <MatchCommentary
              espnId={id}
              live={live}
              started={started}
              active={activeTab === 'lances'}
              refreshSignal={commentarySignal}
              onUnavailable={hideCommentary}
            />
          </LazyPanel>
        )}

        {activeTab === 'estatisticas' &&
          (waiting ? <TimelineSkeleton /> : <MatchStats statistics={history?.statistics ?? []} homeName={homeName} awayName={awayName} />)}

        {activeTab === 'escalacao' &&
          (waiting || !match ? <LineupSkeleton /> : <MatchLineups match={match} lineups={history?.lineups ?? []} events={history?.events ?? []} side={side} onSideChange={setSide} />)}

        <LazyPanel active={activeTab === 'confronto'}>
          {match && <HeadToHead homeId={match.api_home_team_id} awayId={match.api_away_team_id} homeName={homeName} awayName={awayName} />}
        </LazyPanel>

        {hasStandings && (
          <LazyPanel active={activeTab === 'tabela'}>
            <div className="px-2.5 pt-3">
              <StandingsSection
                league={league}
                season={match?.season}
                highlight={[
                  { id: match?.api_home_team_id, name: homeName },
                  { id: match?.api_away_team_id, name: awayName },
                ]}
                focusHighlighted
                active={activeTab === 'tabela'}
                refreshSignal={standingsSignal}
              />
            </div>
          </LazyPanel>
        )}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6 px-5 py-8" aria-hidden>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`flex items-center gap-3 ${i % 2 ? 'flex-row-reverse' : ''}`}>
          <div className={`flex flex-1 flex-col gap-1.5 ${i % 2 ? 'items-start' : 'items-end'}`}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-6.5 w-6.5 rounded-full" />
          <div className="flex-1" />
        </div>
      ))}
    </div>
  );
}

function LineupSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden>
      <div className="flex gap-2.5">
        <Skeleton className="h-9 flex-1 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-full" />
      </div>
      <Skeleton className="aspect-10/13 w-full rounded-xl" />
    </div>
  );
}
