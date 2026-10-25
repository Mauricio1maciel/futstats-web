'use client';

import { ArrowRight, CalendarDays, ChevronRight, ChevronUp, Loader2, Search, ShieldCheck, SlidersHorizontal, Trophy, Tv } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLeagueName } from '@/config/leagues';
import { CalendarSheet } from '@/components/CalendarSheet';
import { FollowStar } from '@/components/FollowStar';
import { FollowingMatches } from '@/components/home/FollowingMatches';
import { MatchRow, MatchRowSkeleton } from '@/components/match/MatchRow';
import { Crest } from '@/components/ui/Crest';
import { UnderlineTabs } from '@/components/ui/Pills';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, OutlineButton } from '@/components/ui/States';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useInterval } from '@/hooks/useInterval';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useRememberedState, useScreenMemory } from '@/hooks/useScreenMemory';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { buildEndpoint, fetchApi, getCachedApi } from '@/lib/api';
import { addDays, formatDayLabel, fromDateKey, matchTime, todayKey } from '@/lib/dates';
import { getEspnMatchId, getPhaseLabel, isFinishedMatch, matchKey } from '@/lib/matches';
import { freezeScrollMemory } from '@/lib/navigation';
import { getFavoriteLeagues } from '@/lib/preferences';
import { setPreview } from '@/lib/preview';
import { leagueHref, matchHref } from '@/lib/routes';
import { asArray, type Match } from '@/lib/types';

type Tab = 'live' | 'all';

// Aba Ao vivo: 15 s com jogo rolando (a API guarda o ao vivo por 15 s e responde 304 se nada mudou);
// sem jogo, a cada 60 s, só para ver se algum começou
const LIVE_REFRESH_MS = 15000;
const IDLE_REFRESH_MS = 60000;
const ADMIN_TAPS = 7;

type LeagueGroup = { code: string; name: string; logo: string; title: string; matches: Match[] };
type DaySection = { date: string; label: string; isToday: boolean; groups: LeagueGroup[] };

// /matches/live traz o ID da ESPN em match_id e id_event; /matches traz o do banco em match_id
function normalize(m: Match, code: string, live: boolean): Match {
  return {
    ...m,
    league: m.league || code,
    match_id: live ? undefined : m.match_id,
    id_event: m.id_event || (live ? String(m.match_id ?? '') : undefined),
    status: m.status || m.state,
    date_event: m.date_event || m.match_date,
  };
}

// Jogos de um dia (ou ao vivo) de todas as ligas favoritas. failed = nenhuma liga respondeu
async function fetchDay(date: string, tab: Tab, leagues: string[], cacheOnly = false) {
  let answered = 0;
  const lists = await Promise.all(
    leagues.map(async code => {
      const endpoint =
        tab === 'live' ? buildEndpoint('/matches/live', { league: code }) : buildEndpoint('/matches', { league: code, date });
      const data = cacheOnly ? getCachedApi(endpoint) : await fetchApi(endpoint);
      if (data != null) answered++;
      const list = asArray<Match>(data).map(m => normalize(m, code, tab === 'live'));
      return tab === 'live' ? list.filter(m => m.state === 'in') : list;
    }),
  );
  return { matches: lists.flat(), failed: leagues.length > 0 && answered === 0 };
}

// Dia -> ligas (pelo horário do primeiro jogo; empate: alfabético) -> jogos (por horário)
function buildDay(date: string, matches: Match[]): DaySection {
  const byLeague = new Map<string, LeagueGroup>();
  matches.forEach(m => {
    const code = String(m.league || '');
    let group = byLeague.get(code);
    if (!group) {
      group = { code, name: getLeagueName(code, m.league_name), logo: m.league_logo || '', title: '', matches: [] };
      byLeague.set(code, group);
    }
    if (!group.logo && m.league_logo) group.logo = m.league_logo;
    group.matches.push(m);
  });
  const kickoff = (m: Match) => matchTime(m) || Number.MAX_SAFE_INTEGER;
  const groups = Array.from(byLeague.values());
  groups.forEach(group => {
    group.matches.sort((a, b) => kickoff(a) - kickoff(b));
    const phase = getPhaseLabel(group.matches[0]);
    group.title = phase ? `${group.name} • ${phase}` : group.name;
  });
  groups.sort((a, b) => kickoff(a.matches[0]) - kickoff(b.matches[0]) || a.name.localeCompare(b.name, 'pt-BR'));
  return { date, label: formatDayLabel(fromDateKey(date)), isToday: date === todayKey(), groups };
}

export function HomeScreen() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const memory = useScreenMemory('home');

  const [tab, setTab] = useRememberedState<Tab>(memory, 'tab', 'live');
  const [selectedDate, setSelectedDate] = useRememberedState(memory, 'date', todayKey);
  const [dates, setDates] = useRememberedState<string[]>(memory, 'dates', []);
  const [byDate, setByDate] = useRememberedState<Record<string, Match[]>>(memory, 'byDate', {});
  const [loadedFor, setLoadedFor] = useRememberedState(memory, 'loadedFor', '');
  const [autoSwitched, setAutoSwitched] = useRememberedState(memory, 'autoSwitched', false);
  const [userOpenedLive, setUserOpenedLive] = useRememberedState(memory, 'userOpenedLive', false);

  const [favorites, setFavorites] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(dates.length === 0);
  const [failed, setFailed] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const taps = useRef({ count: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined });

  // Ligas favoritas (localStorage): lidas depois de montar
  useEffect(() => {
    setFavorites(getFavoriteLeagues());
  }, []);

  const favoritesKey = favorites?.join(',') ?? '';
  // O que está na tela foi carregado para esta aba, data e ligas?
  const currentKey = `${tab}|${selectedDate}|${favoritesKey}`;

  const loadInitial = useCallback(
    async (silent = false) => {
      if (!favorites) return;
      const gen = ++generation.current;
      const key = `${tab}|${selectedDate}|${favorites.join(',')}`;
      if (!silent) {
        setLoading(true);
        setFailed(false);
        // A cópia guardada aparece na hora; a aba Ao Vivo não usa (o jogo pode já ter acabado)
        if (tab === 'all') {
          const cached = await fetchDay(selectedDate, tab, favorites, true);
          if (gen !== generation.current) return;
          if (cached.matches.length > 0) {
            setByDate({ [selectedDate]: cached.matches });
            setDates([selectedDate]);
            setLoadedFor(key);
            setLoading(false);
          }
        }
      }
      const { matches, failed: allFailed } = await fetchDay(selectedDate, tab, favorites);
      if (gen !== generation.current) return;
      if (allFailed && silent) return; // atualização de fundo sem rede: mantém o que está na tela
      setByDate({ [selectedDate]: matches });
      setDates([selectedDate]);
      setLoadedFor(key);
      setFailed(allFailed && matches.length === 0);
      setLoading(false);
      // Primeira abertura sem jogo ao vivo: troca sozinho para Todos Jogos
      if (tab === 'live' && matches.length === 0 && !allFailed && !autoSwitched && !userOpenedLive) {
        setAutoSwitched(true);
        setTab('all');
      }
    },
    [favorites, tab, selectedDate, autoSwitched, userOpenedLive, setByDate, setDates, setLoadedFor, setAutoSwitched, setTab],
  );

  // Carrega quando muda a aba, a data ou as ligas. Voltando de outra tela com a lista em memória,
  // não recarrega (a rolagem volta para onde estava); o Ao Vivo só se atualiza por trás
  const restored = useRef(memory.restore && dates.length > 0);
  useEffect(() => {
    if (!favorites) return;
    if (restored.current && loadedFor === currentKey) {
      restored.current = false;
      setLoading(false);
      if (tab === 'live') loadInitial(true);
      return;
    }
    restored.current = false;
    loadInitial();
    // loadedFor fica de fora de propósito: muda a cada carga e não deve disparar outra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, favorites]);

  const loadMore = async (direction: 'next' | 'prev') => {
    if (tab !== 'all' || !favorites || busy.current || dates.length === 0 || loading) return;
    busy.current = true;
    const gen = generation.current;
    if (direction === 'prev') setLoadingPrev(true);
    try {
      const base = direction === 'next' ? dates[dates.length - 1] : dates[0];
      const target = addDays(base, direction === 'next' ? 1 : -1);
      const { matches, failed: allFailed } = await fetchDay(target, 'all', favorites);
      if (gen !== generation.current || allFailed) return;
      setByDate(prev => ({ ...prev, [target]: matches }));
      setDates(prev => (prev.includes(target) ? prev : direction === 'next' ? [...prev, target] : [target, ...prev]));
    } finally {
      busy.current = false;
      setLoadingPrev(false);
    }
  };

  const sentinel = useInfiniteScroll(() => loadMore('next'), tab === 'all' && !loading && dates.length > 0 && !failed);

  const sections = useMemo(() => dates.map(date => buildDay(date, byDate[date] || [])), [dates, byDate]);
  const total = sections.reduce((sum, day) => sum + day.groups.reduce((n, g) => n + g.matches.length, 0), 0);

  // Ao vivo: 15 s com jogo rolando, 60 s sem. Parado com a aba escondida; na volta, recarrega na hora
  useInterval(() => loadInitial(true), tab === 'live' && !loading ? (total > 0 ? LIVE_REFRESH_MS : IDLE_REFRESH_MS) : null, {
    runOnReturn: true,
  });

  useScrollRestoration('home', !loading && favorites !== null);

  const changeTab = (next: Tab) => {
    if (next === 'live') setUserOpenedLive(true);
    setTab(next);
  };

  // Tocar 7 vezes no logo abre a tela de admin
  const onLogoPress = () => {
    const state = taps.current;
    clearTimeout(state.timer);
    state.count += 1;
    if (state.count >= ADMIN_TAPS) {
      state.count = 0;
      freezeScrollMemory();
      router.push('/admin/');
      return;
    }
    state.timer = setTimeout(() => (state.count = 0), 3000);
  };

  const noFavorites = favorites !== null && favorites.length === 0;
  const showLiveEmpty = tab === 'live' && !loading && total === 0;

  return (
    <div className="pb-safe">
      <header className="sticky top-0 z-30 bg-card pt-safe">
        <div className="flex h-14 items-center px-4">
          <button type="button" onClick={onLogoPress} className="flex items-center text-xl text-ink" aria-label="FutStats">
            <span>Fut</span>
            <span className="font-black">Stats</span>
            <Tv size={20} className="ml-1.5 text-gold-2" />
          </button>
          {isAdmin && (
            <Link
              href="/admin/"
              className="ml-2 inline-flex items-center gap-1 rounded-full border border-gold-2 px-2 py-0.5 text-[11px] font-bold text-gold-2"
            >
              <ShieldCheck size={12} />
              Modo admin
            </Link>
          )}
          <div className="ml-auto flex items-center">
            <button type="button" aria-label="Calendário" onClick={() => setCalendarOpen(true)} className="rounded-full p-2 text-ink active:bg-white/10">
              <CalendarDays size={23} />
            </button>
            <Link href="/minhas-ligas/" aria-label="Minhas ligas" className="rounded-full p-2 text-ink active:bg-white/10">
              <SlidersHorizontal size={22} />
            </Link>
            <Link href="/busca/" aria-label="Buscar" className="-mr-2 rounded-full p-2 text-ink active:bg-white/10">
              <Search size={23} />
            </Link>
          </div>
        </div>
        <UnderlineTabs
          stretch
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'live', label: 'AO VIVO' },
            { value: 'all', label: 'TODOS JOGOS' },
          ]}
          className="border-card-2"
        />
      </header>

      <FollowingMatches />

      <p className="py-3 text-center text-sm font-bold text-ink">
        {tab === 'live' && total > 0 ? 'Destaques' : 'Todos Jogos'}
        {total > 0 && (
          <span className="font-normal text-faint">
            {' '}
            ({total} {total === 1 ? 'Jogo' : 'Jogos'})
          </span>
        )}
      </p>

      {noFavorites ? (
        <EmptyState
          icon={Trophy}
          title="Nenhuma liga escolhida"
          text="Escolha os campeonatos que você quer acompanhar."
          action={
            <Link href="/minhas-ligas/" className="inline-flex items-center gap-1.5 rounded-full border border-accent px-5 py-2.5 text-[13px] font-bold text-accent">
              Escolher ligas <ArrowRight size={14} />
            </Link>
          }
        />
      ) : loading ? (
        <HomeSkeleton />
      ) : showLiveEmpty ? (
        <EmptyState
          icon={Trophy}
          title={failed ? 'Sem conexão' : 'Nenhum jogo no momento'}
          text={
            failed
              ? 'Não foi possível buscar os jogos ao vivo.'
              : 'A bola não está rolando agora. Fique de olho ou confira as partidas agendadas.'
          }
          action={
            <OutlineButton onClick={() => changeTab('all')}>
              Ver Todos os Jogos <ArrowRight size={14} />
            </OutlineButton>
          }
        />
      ) : (
        <div className="px-2.5 pb-10">
          {tab === 'all' && (
            <button
              type="button"
              onClick={() => loadMore('prev')}
              disabled={loadingPrev}
              className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-bold text-accent"
            >
              {loadingPrev ? <Loader2 size={14} className="animate-spin" /> : <ChevronUp size={14} />}
              Ver dia anterior
            </button>
          )}

          {sections.map(day => (
            <section key={day.date}>
              {tab === 'all' && (
                <h2
                  className={`mt-4 px-2.5 py-3 text-xs font-bold ${
                    day.isToday ? 'rounded-t-lg bg-accent/10 text-[13px] text-accent' : 'border-b border-card-2 text-muted'
                  }`}
                >
                  {day.isToday ? 'Hoje • ' : ''}
                  {day.label}
                </h2>
              )}
              {day.groups.length === 0 ? (
                <div className="my-1 flex flex-col items-center rounded-xl bg-card-2 px-5 py-7 text-center">
                  <p className="mb-4 text-[13px] text-muted">
                    {failed ? 'Não foi possível carregar os jogos desta data.' : 'Nenhum dos seus times favoritos está jogando nesta data.'}
                  </p>
                  <OutlineButton onClick={() => setCalendarOpen(true)}>
                    Abrir Calendário <CalendarDays size={14} />
                  </OutlineButton>
                </div>
              ) : (
                day.groups.map(group => (
                  <div key={group.code} className="mt-1.5 overflow-hidden rounded-xl">
                    <Link
                      href={leagueHref(group.code)}
                      onClick={() => setPreview('league', group.code, { name: group.name, logo: group.logo })}
                      className="flex items-center gap-2.5 bg-card-2 px-4 py-3 active:bg-white/5"
                    >
                      <Crest src={group.logo} size={22} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{group.title}</span>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </Link>
                    <div className="divide-y divide-screen border-t border-screen">
                      {group.matches.map((match, index) => (
                        <MatchRow
                          key={matchKey(match, index)}
                          match={match}
                          variant="home"
                          href={matchHref(match, { league: group.code })}
                          aside={
                            !isFinishedMatch(match) && (
                              <FollowStar
                                size={18}
                                target={{ type: 'match', matchId: match.match_id, espnMatchId: getEspnMatchId(match) }}
                              />
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          ))}

          {tab === 'all' && (
            <div ref={sentinel} className="flex h-16 items-center justify-center">
              {!failed && <Loader2 size={20} className="animate-spin text-live" aria-label="Carregando o dia seguinte" />}
            </div>
          )}
        </div>
      )}

      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        leagues={favorites ?? []}
        selectedDate={selectedDate}
        onSelect={date => {
          setSelectedDate(date);
          setTab('all');
        }}
      />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-2.5 pt-1" aria-label="Carregando jogos">
      {[3, 2].map((rows, i) => (
        <div key={i} className="mt-4 overflow-hidden rounded-xl">
          <div className="flex items-center gap-2.5 bg-card-2 px-4 py-3">
            <Skeleton className="h-5.5 w-5.5 rounded-full" />
            <Skeleton className="h-3.5 w-36" />
          </div>
          <div className="divide-y divide-screen border-t border-screen">
            {Array.from({ length: rows }, (_, j) => (
              <MatchRowSkeleton key={j} variant="home" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
