'use client';

import { ChevronDown, ChevronUp, Cloud, Search, Star, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getLeagueName } from '@/config/leagues';
import { MatchRow } from '@/components/match/MatchRow';
import { Crest } from '@/components/ui/Crest';
import { useAccount } from '@/hooks/useAccount';
import { useApi } from '@/hooks/useApi';
import { useFollows } from '@/hooks/useFollows';
import { useInterval } from '@/hooks/useInterval';
import { usePushSupport } from '@/hooks/usePushSupport';
import { followingEndpoint } from '@/lib/follows';
import { getEspnMatchId, isLiveMatch, matchKey } from '@/lib/matches';
import { matchHref } from '@/lib/routes';
import { asArray, type Match } from '@/lib/types';

// 15 s com jogo ao vivo; sem, a cada 60 s (para pegar o jogo que começar)
const LIVE_REFRESH_MS = 15000;
const IDLE_REFRESH_MS = 60000;
// Seguir uma liga pode trazer a rodada inteira no mesmo dia: fechada, a seção mostra só estes
const COLLAPSED_COUNT = 6;

const parse = (raw: unknown) =>
  asArray<Match>(raw).map(m => ({ ...m, status: m.status || m.state, date_event: m.date_event || m.match_date }));

function Header() {
  return (
    <h2 className="flex items-center gap-2 px-2.5 pb-2 pt-4 text-[13px] font-bold text-ink">
      <Star size={15} className="fill-gold-2 text-gold-2" /> Meus jogos
    </h2>
  );
}

const INVITE_KEY = 'account_invite_dismissed';

// Convite discreto para criar conta, depois que a pessoa segue algo (fecha de vez no X)
function AccountInvite() {
  const account = useAccount();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(INVITE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);
  if (account || dismissed) return null;
  return (
    <p className="mx-0.5 mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted">
      <Cloud size={14} className="shrink-0 text-accent" />
      <Link href="/conta/" className="min-w-0 flex-1">
        Salve seus times em todos os aparelhos · <span className="font-bold text-accent">Entrar</span>
      </Link>
      <button
        type="button"
        aria-label="Fechar convite"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(INVITE_KEY, '1');
          } catch {
            // sem armazenamento: some só nesta visita
          }
        }}
        className="-m-1 p-1 text-faint"
      >
        <X size={14} />
      </button>
    </p>
  );
}

// "Meus jogos" no topo da tela inicial: os jogos de HOJE dos times, ligas e jogos seguidos
// (/matches/following, mais os que estão em andamento), em "Ao vivo agora" e "Hoje".
// Sem jogo hoje a seção some. Só onde dá para seguir (notificações disponíveis)
type Props = {
  /** Aba Ao vivo: só os jogos que estão rolando */
  onlyLive?: boolean;
  /** IDs da ESPN dos jogos ao vivo mostrados aqui (a lista de baixo não repete) */
  onLiveShown?: (ids: string[]) => void;
};

export function FollowingMatches({ onlyLive = false, onLiveShown }: Props) {
  const support = usePushSupport();
  const follows = useFollows();
  const endpoint = followingEndpoint(follows);
  const { data, refresh } = useApi(support === 'ok' ? endpoint : null, { parse });
  const [expanded, setExpanded] = useState(false);
  const matches = useMemo(() => (onlyLive ? (data ?? []).filter(isLiveMatch) : (data ?? [])), [data, onlyLive]);
  const liveIds = matches.filter(isLiveMatch).map(getEspnMatchId).filter(Boolean).join(',');
  useEffect(() => {
    onLiveShown?.(liveIds ? liveIds.split(',') : []);
  }, [liveIds, onLiveShown]);
  const hasLive = matches.some(isLiveMatch);

  useInterval(() => refresh(), endpoint && support === 'ok' ? (hasLive ? LIVE_REFRESH_MS : IDLE_REFRESH_MS) : null, { runOnReturn: hasLive });

  // Ao vivo primeiro; fechada, até COLLAPSED_COUNT jogos (todos os ao vivo sempre aparecem)
  const groups = useMemo(() => {
    const live = matches.filter(isLiveMatch);
    const today = matches.filter(m => !isLiveMatch(m));
    const limit = expanded ? matches.length : Math.max(COLLAPSED_COUNT, live.length);
    return [
      { title: 'Ao vivo agora', live: true, matches: live },
      { title: 'Hoje', live: false, matches: today.slice(0, Math.max(0, limit - live.length)) },
    ].filter(group => group.matches.length > 0);
  }, [matches, expanded]);
  const shown = groups.reduce((n, group) => n + group.matches.length, 0);

  if (support !== 'ok' || !follows.loaded) return null;

  if (!endpoint) {
    return (
      <section className="px-2.5">
        <Header />
        <div className="flex items-center gap-3 rounded-xl bg-card-2 px-4 py-3.5">
          <Star size={22} className="shrink-0 text-gold-2" />
          <p className="min-w-0 flex-1 text-[13px] text-muted">Siga seus times tocando na estrela para ver os jogos deles aqui.</p>
          <Link href="/busca/" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent px-3 py-1.5 text-xs font-bold text-accent">
            <Search size={13} /> Buscar
          </Link>
        </div>
      </section>
    );
  }

  // Sem jogo hoje (ou ainda sem resposta nem cópia guardada): só o convite de conta, se couber
  if (matches.length === 0) {
    return (
      <div className="px-2.5 pt-2">
        <AccountInvite />
      </div>
    );
  }

  return (
    <section className="px-2.5">
      <Header />
      {groups.map(group => (
        <div key={group.title} className="mb-2">
          <h3 className={`flex items-center gap-1.5 px-1 pb-1.5 pt-1 text-xs font-bold ${group.live ? 'text-live' : 'text-muted'}`}>
            {group.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />}
            {group.title}
          </h3>
          <div className="space-y-1.5">
            {group.matches.map((match, index) => (
              <div key={matchKey(match, index)} className={`overflow-hidden rounded-xl bg-card-2 ${group.live ? 'ring-1 ring-live/70' : ''}`}>
                <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] text-muted">
                  <Crest src={match.league_logo} size={14} />
                  <span className="truncate">{getLeagueName(match.league, match.league_name)}</span>
                </p>
                <MatchRow match={match} variant="home" href={matchHref(match, { league: match.league })} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {(expanded || shown < matches.length) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-bold text-accent"
        >
          {expanded ? (
            <>
              Mostrar menos <ChevronUp size={14} />
            </>
          ) : (
            <>
              Ver todos ({matches.length}) <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
      <AccountInvite />
    </section>
  );
}
