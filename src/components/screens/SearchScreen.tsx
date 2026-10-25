'use client';

import { ChevronRight, Search, SearchX, Trophy, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getLeagueName } from '@/config/leagues';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { Crest } from '@/components/ui/Crest';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { BackButton } from '@/components/ui/TopBar';
import { useApi } from '@/hooks/useApi';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { buildEndpoint } from '@/lib/api';
import { translatePosition } from '@/lib/positions';
import { setPreview } from '@/lib/preview';
import { leagueHref, playerHref, teamHref } from '@/lib/routes';
import type { SearchResult } from '@/lib/types';

const DEBOUNCE_MS = 500;
const MIN_CHARS = 2;

function ResultRow({ href, onClick, icon, title, subtitle }: { href: string; onClick: () => void; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3.5 px-4 py-3 active:bg-white/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-line-2" />
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="bg-screen px-4 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-faint">{children}</h2>;
}

// Busca de ligas, times e jogadores (/search?q=), a partir de 2 letras
export function SearchScreen() {
  const initial = useSearchParams().get('q') || '';
  const [query, setQuery] = useState(initial);
  const [term, setTerm] = useState(initial.trim());

  // Espera a pessoa parar de digitar; o termo fica no endereço (voltar reabre a mesma busca)
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      setTerm(next);
      const url = next ? `?q=${encodeURIComponent(next)}` : window.location.pathname;
      window.history.replaceState(window.history.state, '', url);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const enabled = term.length >= MIN_CHARS;
  const { data, loading, error, refresh } = useApi<SearchResult>(enabled ? buildEndpoint('/search', { q: term }) : null);
  const typing = query.trim() !== term;
  useScrollRestoration('busca', !loading);

  const leagues = data?.leagues ?? [];
  const teams = data?.teams ?? [];
  const players = data?.players ?? [];
  const empty = leagues.length + teams.length + players.length === 0;

  let content: ReactNode;
  if (!enabled && query.trim().length < MIN_CHARS) {
    content = <EmptyState icon={Search} text="Digite pelo menos 2 letras para buscar ligas, times ou jogadores." />;
  } else if (loading || (typing && (!data || empty))) {
    content = (
      <div className="pt-2" aria-label="Buscando">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (error) {
    content = <ErrorState onRetry={() => refresh()} />;
  } else if (empty) {
    content = <EmptyState icon={SearchX} text={`Nenhum resultado encontrado para “${term}”`} />;
  } else {
    content = (
      <div className="divide-line pb-10">
        {/* Ligas primeiro: quem busca "bundes" quer a liga, não um time dela */}
        {leagues.length > 0 && (
          <section>
            <SectionTitle>Ligas</SectionTitle>
            {leagues.map(league => {
              const name = getLeagueName(league.code, league.name);
              return (
                <ResultRow
                  key={league.code}
                  href={leagueHref(league.code)}
                  onClick={() => setPreview('league', league.code, { name, logo: league.logo_url })}
                  icon={league.logo_url ? <Crest src={league.logo_url} size={28} /> : <Trophy size={20} className="text-faint" />}
                  title={name}
                  subtitle={league.season ? `Temporada ${league.season}` : league.code}
                />
              );
            })}
          </section>
        )}
        {teams.length > 0 && (
          <section>
            <SectionTitle>Times</SectionTitle>
            {teams.map((team, index) => (
              <ResultRow
                key={`${team.api_id}-${index}`}
                href={teamHref(team.api_id)}
                onClick={() => setPreview('team', team.api_id, team)}
                icon={<TeamCrest uri={team.crest_url} name={team.name} size={28} />}
                title={team.name}
                subtitle={[team.league ? getLeagueName(team.league) : '', team.stadium].filter(Boolean).join(' • ') || 'Estádio não informado'}
              />
            ))}
          </section>
        )}
        {players.length > 0 && (
          <section>
            <SectionTitle>Jogadores</SectionTitle>
            {players.map((player, index) => (
              <ResultRow
                key={`${player.id}-${index}`}
                href={playerHref(player.id)}
                onClick={() => setPreview('player', player.id, player)}
                icon={<Crest src={player.headshot_url} size={40} person name={player.name} />}
                title={player.name}
                subtitle={[translatePosition(player.position) || 'Jogador', player.team_name].filter(Boolean).join(' • ')}
              />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div>
      <header className="sticky top-0 z-30 bg-screen/95 pt-safe backdrop-blur">
        <div className="flex h-16 items-center gap-1 px-3">
          <BackButton />
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-card-2 px-3">
            <Search size={20} className="shrink-0 text-faint" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar ligas, times ou jogadores..."
              aria-label="Buscar"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Limpar" onClick={() => setQuery('')} className="-mr-1 p-1 text-faint">
                <X size={18} />
              </button>
            )}
          </label>
        </div>
      </header>
      {content}
    </div>
  );
}
